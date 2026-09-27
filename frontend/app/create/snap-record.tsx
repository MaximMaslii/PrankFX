/**
 * Step 2 of the Snap flow — the metronome recorder.
 *
 * The app dictates the beat instead of detecting a clap. That is not a
 * compromise, it is the point: the backend then knows exactly where to cut,
 * with no audio analysis, no ML, and no edge cases in a noisy room.
 *
 *   "Get ready" -> 3 .. 2 .. 1 -> [recording starts]
 *   1.2 s   haptic + screen flash            = SNAP NOW
 *   4.0 s   "get back into your pose"
 *   3.8 s   onion skin of frame zero fades in over the viewfinder
 *   5.0 s   stop
 *
 * The onion skin is what makes the loop hold together. Without the start
 * silhouette to return to, people drift, the last frame stops matching the
 * first, and the seamless loop — the whole reason for the format — is gone.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { SnapAPI } from "@/src/api/client";
import { SnapFlow } from "@/src/utils/createFlow";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

// Fallbacks. The real numbers come from the server so the flash and the cut
// can never drift apart.
const DEFAULT_TOTAL = 5.0;
const DEFAULT_SNAP_AT = 1.2;
const DEFAULT_RETURN_HINT = 4.0;

/** How long before the end the start frame fades in over the viewfinder. */
const ONION_LEAD = 1.2;

type Phase = "idle" | "arming" | "countdown" | "recording" | "saving";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SnapRecord() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const effect = SnapFlow.getEffect();

  const cameraRef = useRef<CameraView | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<CameraType>("front");
  const [mode, setMode] = useState<"picture" | "video">("picture");
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [frameZero, setFrameZero] = useState<string | null>(null);

  const [timing, setTiming] = useState({
    total: DEFAULT_TOTAL,
    snapAt: DEFAULT_SNAP_AT,
    returnHint: DEFAULT_RETURN_HINT,
  });

  const flash = useRef(new Animated.Value(0)).current;

  // ------------------------------------------------------------------
  // Server timings
  // ------------------------------------------------------------------
  useEffect(() => {
    let alive = true;

    SnapAPI.catalog()
      .then((catalog) => {
        if (!alive) return;
        setTiming({
          total: catalog.total_seconds || DEFAULT_TOTAL,
          snapAt: catalog.snap_at_seconds || DEFAULT_SNAP_AT,
          returnHint: catalog.return_hint_seconds || DEFAULT_RETURN_HINT,
        });
      })
      .catch(() => { /* the defaults match the server's own constants */ });

    return () => { alive = false; };
  }, []);

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelled.current = true;
      clearTimers();
      try { cameraRef.current?.stopRecording(); } catch { /* not recording */ }
    };
  }, [clearTimers]);

  // ------------------------------------------------------------------
  // Permissions
  // ------------------------------------------------------------------
  const ensurePermissions = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const granted = await requestCameraPermission();
      if (!granted.granted) {
        Toast.error(t("snap_camera_required"));
        return false;
      }
    }

    // Audio is optional: without it the clip simply has no voice track, and
    // the pipeline lays the impact hit over silence.
    if (!micPermission?.granted) {
      await requestMicPermission().catch(() => null);
    }

    return true;
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission, t]);

  // ------------------------------------------------------------------
  // The take
  // ------------------------------------------------------------------
  const fireFlash = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    flash.setValue(1);
    Animated.timing(flash, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [flash]);

  const start = useCallback(async () => {
    if (phase !== "idle") return;
    if (!effect) {
      router.replace("/create/snap-effect");
      return;
    }

    if (!(await ensurePermissions())) return;

    cancelled.current = false;
    setElapsed(0);
    setPhase("arming");

    // Frame zero: the silhouette the clip has to collapse back into. Taken in
    // picture mode, because the camera cannot hand out a still while it is
    // configured for video on every device.
    try {
      const shot = await cameraRef.current?.takePictureAsync({
        quality: 0.4,
        skipProcessing: true,
      });
      if (shot?.uri) setFrameZero(shot.uri);
    } catch {
      // An onion skin is an aid, not a requirement — the backend extracts the
      // real frame zero from the recording itself.
      setFrameZero(null);
    }

    if (cancelled.current) return;

    setMode("video");
    await wait(700); // let the camera reconfigure before recordAsync

    if (cancelled.current) return;

    // 3 .. 2 .. 1
    setPhase("countdown");
    for (const n of [3, 2, 1]) {
      if (cancelled.current) return;
      setCount(n);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await wait(1000);
    }

    if (cancelled.current) return;

    setPhase("recording");

    const startedAt = Date.now();

    ticker.current = setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000);
    }, 50);

    timers.current.push(setTimeout(fireFlash, timing.snapAt * 1000));

    timers.current.push(
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, timing.returnHint * 1000),
    );

    timers.current.push(
      setTimeout(() => {
        try { cameraRef.current?.stopRecording(); } catch { /* already stopped */ }
      }, timing.total * 1000),
    );

    try {
      // maxDuration is a safety net in case stopRecording never lands.
      const video = await cameraRef.current?.recordAsync({
        maxDuration: Math.ceil(timing.total) + 2,
      });

      clearTimers();

      if (cancelled.current) return;

      if (!video?.uri) {
        setPhase("idle");
        Toast.error(t("snap_record_failed"));
        return;
      }

      setPhase("saving");
      SnapFlow.setVideo(video.uri);
      router.replace("/create/snap-processing");

    } catch (e: any) {
      clearTimers();
      if (cancelled.current) return;
      setPhase("idle");
      setMode("picture");
      Toast.error(e?.message || t("snap_record_failed"));
    }
  }, [
    phase, effect, ensurePermissions, fireFlash, timing,
    clearTimers, router, t,
  ]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const remaining = Math.max(0, timing.total - elapsed);
  const recording = phase === "recording";
  const showOnion = recording && remaining < ONION_LEAD && !!frameZero;
  const progress = Math.min(1, elapsed / timing.total);

  let banner = t("snap_get_ready");

  if (phase === "countdown") banner = String(count);
  else if (recording && elapsed < timing.snapAt) banner = t("snap_hold_still");
  else if (recording && elapsed < timing.returnHint) banner = t("snap_now");
  else if (recording) banner = t("snap_back_to_pose");

  if (!cameraPermission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface, padding: Spacing.xl }]}>
        <Ionicons name="videocam-off" size={42} color={colors.onSurfaceTertiary} />
        <Text style={[styles.permText, { color: colors.onSurface }]}>{t("snap_camera_required")}</Text>
        <Pressable
          testID="snap-grant-camera"
          onPress={requestCameraPermission}
          style={[styles.permButton, { backgroundColor: colors.brand }]}
        >
          <Text style={[styles.permButtonText, { color: colors.onBrand }]}>{t("snap_grant_access")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={(ref) => { cameraRef.current = ref; }}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={mode}
        videoQuality="720p"
      />

      {/* Onion skin: the start frame, so people can step back into it. */}
      {showOnion && (
        <Image
          source={{ uri: frameZero! }}
          style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
          contentFit="cover"
          transition={200}
        />
      )}

      {/* The snap flash. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flash }]}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="snap-record-back"
          onPress={() => { cancelled.current = true; router.back(); }}
          style={styles.iconButton}
          disabled={recording}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        <View style={styles.effectChip}>
          <Text style={styles.effectChipText}>
            {effect?.emoji} {effect ? effect.title || t(`snap_fx_${effect.effect_id}` as any) : ""}
          </Text>
        </View>

        <Pressable
          testID="snap-flip-camera"
          onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
          style={styles.iconButton}
          disabled={phase !== "idle"}
        >
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Banner */}
      <View style={styles.bannerWrap} pointerEvents="none">
        <Text
          style={[
            styles.banner,
            phase === "countdown" && styles.bannerCountdown,
            recording && elapsed >= timing.snapAt && elapsed < timing.returnHint && styles.bannerSnap,
          ]}
        >
          {banner}
        </Text>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {recording && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            {/* The mark sits exactly where the backend cuts. */}
            <View style={[styles.snapMark, { left: `${(timing.snapAt / timing.total) * 100}%` }]} />
          </View>
        )}

        <Pressable
          testID="snap-record-button"
          onPress={start}
          disabled={phase !== "idle"}
          style={[styles.shutter, phase !== "idle" && styles.shutterBusy]}
        >
          {phase === "idle" ? (
            <View style={styles.shutterInner} />
          ) : (
            <Text style={styles.shutterLabel}>
              {recording ? remaining.toFixed(1) : phase === "countdown" ? String(count) : "…"}
            </Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          {phase === "idle" ? t("snap_record_hint") : t("snap_dont_move")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg },
  permText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, textAlign: "center" },
  permButton: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.pill },
  permButtonText: { color: "#fff", fontSize: FontSize.md, fontWeight: FontWeight.bold },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  iconButton: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  effectChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: 6,
    borderRadius: Radius.pill, backgroundColor: "rgba(0,0,0,0.45)",
  },
  effectChipText: { color: "#fff", fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  bannerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: {
    color: "#fff", fontSize: FontSize.xl2, fontWeight: FontWeight.heavy,
    textAlign: "center", paddingHorizontal: Spacing.xl,
    textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 },
  },
  bannerCountdown: { fontSize: 96 },
  bannerSnap: { fontSize: 54, color: "#FFD60A" },

  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", gap: Spacing.lg },
  progressTrack: {
    width: "70%", height: 5, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden", justifyContent: "center",
  },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 3 },
  snapMark: { position: "absolute", width: 2, height: 11, backgroundColor: "#FFD60A" },

  shutter: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 4, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  shutterBusy: { borderColor: "rgba(255,255,255,0.5)" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#FF453A" },
  shutterLabel: { color: "#fff", fontSize: FontSize.xl, fontWeight: FontWeight.heavy },

  hint: {
    color: "rgba(255,255,255,0.85)", fontSize: FontSize.sm,
    textAlign: "center", paddingHorizontal: Spacing.xl,
  },
});
