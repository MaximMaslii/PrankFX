/**
 * Step 3 — send the take (a recording or a photo) and wait for the job.
 *
 * The clip takes a minute or two, so the server answers with a job id
 * straight away and this screen polls. FX credits are charged when the job is
 * created and refunded by the server on any failure, so leaving this screen
 * never costs a user anything they did not get.
 *
 * The wait is the riskiest moment for retention: a bare spinner for ninety
 * seconds reads as "broken". So the photo sits on screen with a scan line
 * running over it, a progress bar that keeps moving, and a caption that
 * changes every few seconds.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { SnapAPI, SnapJob } from "@/src/api/client";
import { SnapFlow } from "@/src/utils/createFlow";
import { snapGradientFor } from "@/src/utils/snapEffects";
import { FontSize, FontWeight, Radius, Spacing, glow } from "@/src/theme/tokens";

const POLL_INTERVAL_MS = 2500;

/** Stop polling eventually rather than spinning forever on a wedged worker. */
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

/** Rough length of a PixVerse render — only drives the progress bar. */
const EXPECTED_PHOTO_MS = 80_000;
const EXPECTED_VIDEO_MS = 50_000;

export default function SnapProcessing() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const alive = useRef(true);
  const [stage, setStage] = useState<string>("uploading");
  const [failed, setFailed] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  const effect = SnapFlow.getEffect();
  const photo = SnapFlow.getPhoto();
  const isPhoto = effect?.input === "photo";

  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scan]);

  // Clock for the progress bar and the rotating captions.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const run = useCallback(async () => {
    const videoUri = SnapFlow.getVideo();
    const currentPhoto = SnapFlow.getPhoto();

    if (!effect || (effect.input === "photo" ? !currentPhoto : !videoUri)) {
      router.replace("/create/snap-effect");
      return;
    }

    setFailed(null);
    setStage("uploading");
    setStartedAt(Date.now());

    let job: SnapJob;

    try {
      job = effect.input === "photo"
        ? await SnapAPI.createPhotoJob(currentPhoto!.base64, effect.effect_id)
        : await SnapAPI.createJob(videoUri!, effect.effect_id);
    } catch (e: any) {
      if (!alive.current) return;

      // 402 means the balance is short — send them to the paywall instead of
      // showing a generic error they can do nothing about.
      if (e?.status === 402) {
        router.replace({
          pathname: "/paywall",
          params: { reason: "snap" },
        });
        return;
      }

      setFailed(e?.message || t("error_generic"));
      return;
    }

    if (!alive.current) return;

    SnapFlow.setJobId(job.job_id);

    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (alive.current) {
      if (Date.now() > deadline) {
        setFailed(t("snap_timeout"));
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      if (!alive.current) return;

      let current: SnapJob;

      try {
        current = await SnapAPI.getJob(job.job_id);
      } catch {
        // One dropped poll on a mobile network is not a failed clip — the
        // job keeps running on the server. Try again on the next tick.
        continue;
      }

      if (!alive.current) return;

      setStage(current.stage || current.status);

      if (current.status === "completed") {
        router.replace({ pathname: "/create/snap-result", params: { jid: job.job_id } });
        return;
      }

      if (current.status === "failed") {
        setFailed(current.error || t("error_generic"));
        return;
      }
    }
  }, [effect, router, t]);

  useEffect(() => {
    alive.current = true;
    run();
    return () => { alive.current = false; };
  }, [run]);

  const stageLabel = ((): string => {
    switch (stage) {
      case "uploading": return t("snap_stage_uploading");
      case "queued": return t("snap_stage_queued");
      case "cutting": return t("snap_stage_cutting");
      case "generating": return isPhoto ? t("snap_stage_animating") : t("snap_stage_generating");
      case "assembling": return t("snap_stage_assembling");
      default: return t("snap_stage_queued");
    }
  })();

  // Eases toward 95% and never claims to be done before the server does.
  const elapsed = Math.max(0, now - startedAt);
  const expected = isPhoto ? EXPECTED_PHOTO_MS : EXPECTED_VIDEO_MS;
  const progress = stage === "assembling"
    ? 0.96
    : Math.min(0.95, 1 - Math.exp(-elapsed / (expected / 2.2)));

  const tips = [t("snap_wait_tip_1"), t("snap_wait_tip_2"), t("snap_wait_tip_3")];
  const tip = tips[Math.floor(elapsed / 6000) % tips.length];

  const gradient = snapGradientFor(effect?.effect_id || "");
  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, 300] });

  if (failed) {
    return (
      <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 60 }]}>
        <Ionicons name="alert-circle" size={54} color={colors.error} />
        <Text style={[styles.title, { color: colors.onSurface }]}>{t("snap_failed_title")}</Text>
        <Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>{failed}</Text>
        <Text style={[styles.refund, { color: colors.onSurfaceTertiary }]}>{t("snap_refunded")}</Text>

        <View style={styles.actions}>
          <Pressable testID="snap-retry" onPress={run} style={{ flex: 1 }}>
            <LinearGradient
              colors={colors.brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={[styles.buttonText, { color: colors.onBrand }]}>{t("retry")}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            testID="snap-give-up"
            onPress={() => router.replace("/create/snap-effect")}
            style={[styles.button, styles.buttonGhost, { borderColor: colors.border, flex: 1 }]}
          >
            <Text style={[styles.buttonText, { color: colors.onSurface }]}>{t("snap_try_another")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 32 }]}>
      <LinearGradient colors={colors.bgGradient} style={StyleSheet.absoluteFill} />

      <View style={[styles.frame, glow(gradient[1], "md")]}>
        {isPhoto && photo?.uri ? (
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
            <View style={styles.frameEmojiWrap}>
              <Text style={styles.frameEmoji}>{effect?.emoji}</Text>
            </View>
          </LinearGradient>
        )}

        {/* The moving part has to be an Animated.View: an animated value on a
            plain view (LinearGradient is one) crashes the native renderer
            with "translateY must be a number". */}
        <Animated.View
          pointerEvents="none"
          style={[styles.scanBar, { transform: [{ translateY: scanY }] }]}
        >
          <LinearGradient
            colors={[`${gradient[0]}00`, `${gradient[0]}AA`, `${gradient[1]}00`]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.effectChip}>
          <Text style={styles.effectChipText}>
            {effect?.emoji} {effect ? effect.title || t(`snap_fx_${effect.effect_id}` as any) : ""}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.onSurface }]}>{stageLabel}</Text>

      <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]}
        />
      </View>

      <Text style={[styles.tip, { color: colors.onSurfaceSecondary }]}>{tip}</Text>

      <View style={styles.waitRow}>
        <ActivityIndicator size="small" color={colors.brand} />
        <Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>
          {isPhoto ? t("snap_photo_wait") : t("snap_stay_here")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", paddingHorizontal: Spacing.xl, gap: Spacing.md },

  frame: {
    width: 230,
    height: 310,
    borderRadius: Radius.xl,
    overflow: "hidden",
    marginBottom: Spacing.md,
    backgroundColor: "#000",
  },
  frameEmojiWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  frameEmoji: { fontSize: 72 },
  scanBar: { position: "absolute", left: 0, right: 0, top: -10, height: 36 },
  effectChip: {
    position: "absolute",
    left: Spacing.md,
    bottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(5,4,12,0.6)",
  },
  effectChipText: { color: "#fff", fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginTop: Spacing.sm, textAlign: "center" },
  track: { width: "80%", height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  tip: { fontSize: FontSize.md, textAlign: "center", minHeight: 42, marginTop: Spacing.xs },
  waitRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.xl },

  sub: { fontSize: FontSize.md, textAlign: "center", flexShrink: 1 },
  refund: { fontSize: FontSize.sm, textAlign: "center", marginTop: Spacing.sm },
  actions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xl, alignSelf: "stretch" },
  button: {
    height: 52, borderRadius: Radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  buttonGhost: { borderWidth: 1 },
  buttonText: { color: "#fff", fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
