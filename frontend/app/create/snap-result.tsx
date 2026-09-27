/**
 * Step 4 — the result, autoplaying on a hard loop.
 *
 * The loop is the product. Someone who did not catch what happened watches it
 * a second and a third time, and completion rate is the ranking signal the
 * whole format is built around, so the player never stops and there are no
 * controls to stop it with.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { SnapAPI, SnapJob, SubAPI } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthProvider";
import { PAYWALL_DELAY_MS, shouldOfferPaywall } from "@/src/utils/paywall";
import { useI18n } from "@/src/i18n/I18nProvider";
import { SnapFlow } from "@/src/utils/createFlow";
import { snapCopy } from "@/src/utils/snapEffects";
import { downloadSnap, saveSnapToGallery, SNAP_HASHTAG } from "@/src/utils/snapVideo";
import { APP_LABEL, shareResult, SocialApp } from "@/src/utils/share";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function SnapResult() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jid?: string }>();
  const { user } = useAuth();

  const jobId = params.jid || SnapFlow.getJobId() || "";
  const flowEffect = SnapFlow.getEffect();

  // Opened from "My videos", the in-memory flow belongs to some other clip —
  // the job itself is the truth about which effect this was.
  const [job, setJob] = useState<SnapJob | null>(null);
  const effectId = job?.effect_id || flowEffect?.effect_id || "";
  const isPhoto = (job?.input || flowEffect?.input) === "photo";

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [muted, setMuted] = useState(false);

  const player = useVideoPlayer(localUri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  // ---------------------------------------------------------------
  // The offer, after the result — never before it.
  //
  // Someone who has just watched the thing work is in a completely different
  // frame of mind from someone looking at a price list on launch. So the
  // paywall waits for the result to land, checks that the balance really is
  // empty, and respects the cooldown in paywall.ts so it cannot become a
  // toll booth on every creation.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!localUri || user?.is_premium) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const [balance, allowed] = await Promise.all([
          SubAPI.fxBalance(),
          shouldOfferPaywall(),
        ]);

        // Still has FX: nothing to sell them yet, and interrupting would
        // only get in the way of the next one.
        if (cancelled || !allowed || balance.fx_credits > 0) return;

        router.push({
          pathname: "/paywall",
          params: { reason: "first_result" },
        });
      } catch {
        // Offline. A finished result is not the moment to show an error.
      }
    }, PAYWALL_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [localUri, user?.is_premium, router]);

  const load = useCallback(async () => {
    if (!jobId) {
      router.replace("/home");
      return;
    }

    setError(null);

    SnapAPI.getJob(jobId).then(setJob).catch(() => { /* name falls back to the flow */ });

    try {
      setLocalUri(await downloadSnap(jobId));
    } catch (e: any) {
      setError(e?.message || t("error_generic"));
    }
  }, [jobId, router, t]);

  useEffect(() => { load(); }, [load]);

  // A clip that arrives while the screen is already open still has to start
  // itself; the initialiser above only runs for the first source.
  useEffect(() => {
    if (localUri && !isPlaying) {
      try { player.play(); } catch { /* player torn down */ }
    }
  }, [localUri, isPlaying, player]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try { player.muted = next; } catch { /* player torn down */ }
  };

  const save = async () => {
    if (!localUri || saving) return;

    setSaving(true);
    Haptics.selectionAsync().catch(() => {});

    const ok = await saveSnapToGallery(localUri);

    if (ok) Toast.success(t("saved"));

    setSaving(false);
  };

  /**
   * `app` named → save to the camera roll and open that app, where the clip
   * is the first item in the picker. No app → the system share sheet.
   * Either way the caption is on the clipboard, one paste from the composer.
   */
  const share = async (app?: SocialApp) => {
    if (!localUri) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const name = effectId
      ? snapCopy(t, lang, effectId, "title", undefined, job?.effect_name || flowEffect?.title || "")
      : "";

    try {
      await shareResult({
        uri: localUri,
        mimeType: "video/mp4",
        uti: "public.mpeg-4",
        dialogTitle: t("snap_share_to_tiktok"),
        caption: `${t("snap_share_caption")} ${name} ${SNAP_HASHTAG}`
          .replace(/\s+/g, " ")
          .trim(),
        captionCopiedNotice: t("snap_caption_copied"),
        app,
        save: () => saveSnapToGallery(localUri),
        savedNotice: app
          ? t("share_saved_pick").replace("{app}", APP_LABEL[app])
          : undefined,
      });
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    }
  };

  const again = () => {
    SnapFlow.setVideo(null);
    SnapFlow.setJobId(null);

    // A photo Snap goes back to the effect grid — the same photo with another
    // effect is the most common "one more". A recorded one re-arms the camera,
    // but only if the flow still knows which effect that was.
    if (isPhoto || !flowEffect || flowEffect.effect_id !== effectId) {
      router.replace("/create/snap-effect");
      return;
    }

    router.replace("/create/snap-record");
  };

  return (
    <View style={[styles.root, { backgroundColor: "#000" }]}>
      {localUri ? (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          contentFit={isPhoto ? "contain" : "cover"}
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      ) : (
        <View style={styles.center}>
          {error ? (
            <>
              <Ionicons name="cloud-offline" size={48} color="#fff" />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable testID="snap-result-retry" onPress={load} style={styles.ghostButton}>
                <Text style={styles.ghostButtonText}>{t("retry")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.errorText}>{t("snap_loading_clip")}</Text>
            </>
          )}
        </View>
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="snap-result-home" onPress={() => router.replace("/home")} style={styles.iconButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        <View style={styles.loopChip}>
          <Ionicons name="repeat" size={13} color="#fff" />
          <Text style={styles.loopChipText}>{t("snap_loops_forever")}</Text>
        </View>

        <Pressable testID="snap-result-mute" onPress={toggleMute} style={styles.iconButton}>
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Bottom actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          testID="snap-share-tiktok"
          onPress={() => share("tiktok")}
          disabled={!localUri}
        >
          <LinearGradient
            colors={["#25F4EE", "#FE2C55"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.primary, !localUri && styles.disabled]}
          >
            <Ionicons name="musical-notes" size={20} color="#fff" />
            <Text style={styles.primaryText}>{t("snap_share_to_tiktok")}</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            testID="snap-share-instagram"
            onPress={() => share("instagram")}
            disabled={!localUri}
            style={[styles.secondary, !localUri && styles.disabled]}
          >
            <Ionicons name="logo-instagram" size={20} color="#fff" />
            <Text style={styles.secondaryText}>Instagram</Text>
          </Pressable>

          <Pressable
            testID="snap-share-more"
            onPress={() => share()}
            disabled={!localUri}
            style={[styles.secondary, !localUri && styles.disabled]}
          >
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={styles.secondaryText}>{t("share")}</Text>
          </Pressable>
        </View>

        <View style={styles.secondaryRow}>
          <Pressable
            testID="snap-save"
            onPress={save}
            disabled={!localUri || saving}
            style={[styles.secondary, (!localUri || saving) && styles.disabled]}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="download-outline" size={20} color="#fff" />}
            <Text style={styles.secondaryText}>{t("save")}</Text>
          </Pressable>

          <Pressable testID="snap-again" onPress={again} style={styles.secondary}>
            <Ionicons name={isPhoto ? "sparkles" : "refresh"} size={20} color="#fff" />
            <Text style={styles.secondaryText}>{isPhoto ? t("snap_try_another") : t("snap_again")}</Text>
          </Pressable>
        </View>

        <Text style={styles.hashtagHint}>
          {t("snap_hashtag_hint").replace("{tag}", SNAP_HASHTAG)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg, padding: Spacing.xl },
  errorText: { color: "#fff", fontSize: FontSize.md, textAlign: "center" },
  ghostButton: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)",
  },
  ghostButtonText: { color: "#fff", fontSize: FontSize.md, fontWeight: FontWeight.bold },

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
  loopChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: 6,
    borderRadius: Radius.pill, backgroundColor: "rgba(0,0,0,0.45)",
  },
  loopChipText: { color: "#fff", fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  bottom: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.xl, gap: Spacing.md,
  },
  primary: {
    height: 56, borderRadius: Radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md,
  },
  primaryText: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  secondaryRow: { flexDirection: "row", gap: Spacing.md },
  secondary: {
    flex: 1, height: 50, borderRadius: Radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  secondaryText: { color: "#fff", fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  disabled: { opacity: 0.5 },
  hashtagHint: {
    color: "rgba(255,255,255,0.7)", fontSize: FontSize.xs,
    textAlign: "center", marginTop: 2,
  },
});
