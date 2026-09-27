import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { getEffectName } from "@/src/i18n/effectNames";
import { GenAPI, ProjectFull, ProjectsAPI, SubAPI } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthProvider";
import { PAYWALL_DELAY_MS, shouldOfferPaywall } from "@/src/utils/paywall";
import { BeforeAfterSlider } from "@/src/components/BeforeAfterSlider";
import { CreateFlow } from "@/src/utils/createFlow";
import { toDataUri } from "@/src/utils/images";
import { saveBase64ToGallery } from "@/src/utils/saveImage";
import {
  APP_LABEL,
  base64ToCacheFile,
  shareResult,
  SocialApp,
} from "@/src/utils/share";
import { SNAP_HASHTAG } from "@/src/utils/snapVideo";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function Result() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pid?: string }>();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectFull | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!params.pid) {
      const cached = CreateFlow.getResult();
      if (cached) setProject(cached);
      return;
    }
    const cached = CreateFlow.getResult();
    if (cached && cached.project_id === params.pid) {
      setProject(cached);
      return;
    }
    setLoading(true);
    try {
      const p = await ProjectsAPI.get(params.pid);
      setProject(p);
      CreateFlow.setResult(p);
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  }, [params.pid, t]);

  useEffect(() => { load(); }, [load]);

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
    if (!project || user?.is_premium) return;

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
  }, [project?.project_id, user?.is_premium, router]);

  const toggleFav = async () => {
    if (!project) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await ProjectsAPI.setFavorite(project.project_id, !project.is_favorite);
      setProject({ ...project, is_favorite: !project.is_favorite });
    } catch { /* noop */ }
  };

  /**
   * Share the picture.
   *
   * `app` undefined opens the system sheet; naming an app saves the image to
   * the camera roll first and then opens that app, because neither TikTok nor
   * Instagram accepts a file handed to it from outside without a native SDK.
   * The old code passed a `data:` URI to RN's Share, which Android drops —
   * the caption went out without the picture.
   */
  const shareTo = async (app?: SocialApp) => {
    if (!project) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    const effectLabel = getEffectName(
      project.effect_id,
      lang,
      project.effect_name || "",
    );

    const caption = `${t("share_photo_caption").replace("{effect}", effectLabel)} ${SNAP_HASHTAG}`
      .replace(/\s+/g, " ")
      .trim();

    const filename = `prankfx_${project.effect_id}_${Date.now()}.jpg`;

    try {
      // =========================
      // WEB — download, there is no share sheet to speak of.
      // =========================
      if (Platform.OS === "web") {
        const link = document?.createElement?.("a");

        if (link) {
          link.href = toDataUri(project.result_image);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          Toast.success(t("saved"));
          return;
        }

        Toast.error("Sharing is not supported in this browser.");
        return;
      }

      const uri = await base64ToCacheFile(project.result_image, filename);

      await shareResult({
        uri,
        mimeType: "image/jpeg",
        uti: "public.jpeg",
        dialogTitle: t("share"),
        caption,
        captionCopiedNotice: t("share_caption_copied"),
        app,
        save: () => saveBase64ToGallery(project.result_image, filename),
        savedNotice: app
          ? t("share_saved_pick").replace("{app}", APP_LABEL[app])
          : undefined,
      });
    } catch (error: any) {
      if (
        error?.name === "AbortError" ||
        error?.message?.toLowerCase?.().includes("cancel")
      ) {
        return;
      }

      Toast.error(error?.message || t("error_generic"));
    }
  };


  const save = async () => {
    if (!project) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const name = `prankfx_${project.effect_id}_${Date.now()}.jpg`;
    await saveBase64ToGallery(project.result_image, name);
  };

  const tryAnother = () => {
    Haptics.selectionAsync().catch(() => {});
    router.replace("/create/pick-effect");
  };

  const regenerate = async () => {
    if (!project) return;

    Haptics.selectionAsync().catch(() => {});
    setLoading(true);

    try {
      const result = await GenAPI.generate(
        project.original_image,
        project.effect_id,
        true
      );

      setProject(result);
      CreateFlow.setResult(result);
      Toast.success("Regenerated");
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  const del = async () => {
    if (!project || loading) return;

    try {
      setLoading(true);

      await ProjectsAPI.remove(project.project_id);

      Toast.success(t("deleted"));
      router.replace("/history");
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 200 + insets.bottom, paddingHorizontal: Spacing.xl }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable testID="result-back" onPress={() => router.replace("/home")} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={[styles.title, { color: colors.onSurface }]}>
            {project?.effect_id
              ? getEffectName(project.effect_id, lang, project.effect_name || t("result_title"))
              : t("result_title")}
          </Text>
          <Pressable testID="result-favorite" onPress={toggleFav} disabled={loading} style={styles.back}>
            <Ionicons name={project?.is_favorite ? "heart" : "heart-outline"} size={24} color={project?.is_favorite ? colors.error : colors.onSurface} />
          </Pressable>
        </View>

        {project ? (
          <BeforeAfterSlider
            beforeUri={toDataUri(project.original_image)}
            afterUri={toDataUri(project.result_image)}
          />
        ) : (
          <View style={{ height: 400, borderRadius: Radius.lg, backgroundColor: colors.surfaceSecondary }} />
        )}

        <Text style={[styles.hint, { color: colors.onSurfaceTertiary }]}>
          {t("compare_slider_hint")}
        </Text>

        {/* Share row.
            Three buttons that do three different things, instead of five
            that all opened the same sheet. */}
        <View style={styles.shareRow}>
          <ShareBtn
            testID="share-tiktok"
            label="TikTok"
            icon="musical-notes"
            onPress={() => shareTo("tiktok")}
          />
          <ShareBtn
            testID="share-instagram"
            label="Instagram"
            icon="logo-instagram"
            onPress={() => shareTo("instagram")}
          />
          <ShareBtn
            testID="share-more"
            label={t("share")}
            icon="share-social"
            onPress={() => shareTo()}
          />
        </View>
      </ScrollView>

      {/* Sticky actions */}
<View
  style={[
    styles.sticky,
    {
      paddingBottom: insets.bottom + 80,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ]}
>
  <View style={{ flexDirection: "row", gap: Spacing.md }}>
    <Pressable 
      testID="save-btn" 
      onPress={save}
      disabled={loading} 
      style={{ flex: 1, opacity: loading ? 0.5 : 1 }}
    >
      <View
        style={[
          styles.saveBtn,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="download" size={20} color={colors.onSurface} />
        <Text style={[styles.saveText, { color: colors.onSurface }]}>
          {t("save_gallery")}
        </Text>
      </View>
    </Pressable>

    <Pressable
      testID="share-btn"
      onPress={() => shareTo()}
      disabled={loading}
      style={{ flex: 1, opacity: loading ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={colors.brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.saveBtn, { borderColor: "transparent" }]}
      >
        <Ionicons name="share-outline" size={20} color={colors.onBrand} />
        <Text style={[styles.saveText, { color: colors.onBrand }]}>
          {t("share")}
        </Text>
      </LinearGradient>
    </Pressable>
  </View>
    
    <Pressable
      testID="regenerate-btn"
      onPress={regenerate}
      disabled={loading}
      style={{ marginTop: Spacing.md }}
    >
      <View
        style={[
          styles.saveBtn,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
            opacity: loading ? 0.5 : 1,
          },
        ]}
      >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onSurface} />
      ) : (
        <Ionicons
          name="refresh"
          size={20}
          color={colors.onSurface}
        />
      )}
        
        <Text style={[styles.saveText, { color: colors.onSurface }]}>
          {loading ? t("ai_creating_version") : t("regenerate")}
        </Text>
      </View>
    </Pressable>
  
  {/* Delete */}
  <Pressable
    testID="delete-btn"
    onPress={del}
    disabled={loading}
    style={{ marginTop: Spacing.md, opacity: loading ? 0.5 : 1 }}
  >
    <View
      style={[
        styles.saveBtn,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons
        name="trash-outline"
        size={20}
        color={colors.error}
      />
      <Text style={[styles.saveText, { color: colors.error }]}>
        {t("delete")}
      </Text>
    </View>
  </Pressable>

  {/* Try Another Effect */}
  <Pressable
    testID="try-another-btn"
    onPress={tryAnother}
    disabled={loading}
    style={{ marginTop: Spacing.md, opacity: loading ? 0.5 : 1 }}
  >
    <View
      style={[
        styles.saveBtn,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons
        name="sparkles-outline"
        size={20}
        color={colors.brand}
      />
      <Text style={[styles.saveText, { color: colors.brand }]}>
        {t("try_another_effect")}
      </Text>
    </View>
  </Pressable>
</View>
    </View>
  );
}

function ShareBtn({ label, icon, onPress, testID }: { label: string; icon: any; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={{ alignItems: "center", gap: 6 }}>
      <View style={[styles.shareBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Ionicons name={icon} size={22} color={colors.onSurface} />
      </View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  back: { padding: 6 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, flex: 1, textAlign: "center" },
  hint: { fontSize: FontSize.sm, textAlign: "center", marginTop: Spacing.md },
  shareRow: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.xl2 },
  shareBtn: { width: 52, height: 52, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  sticky: { position: "absolute", left: 0, right: 0, bottom: 0, padding: Spacing.xl, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: Radius.pill, borderWidth: 1 },
  saveText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});
