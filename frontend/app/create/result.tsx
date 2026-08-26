import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { getEffectName } from "@/src/i18n/effectNames";
import { GenAPI, ProjectFull, ProjectsAPI } from "@/src/api/client";
import { BeforeAfterSlider } from "@/src/components/BeforeAfterSlider";
import { CreateFlow } from "@/src/utils/createFlow";
import { toDataUri } from "@/src/utils/images";
import { saveBase64ToGallery } from "@/src/utils/saveImage";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function Result() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pid?: string }>();

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

  const toggleFav = async () => {
    if (!project) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await ProjectsAPI.setFavorite(project.project_id, !project.is_favorite);
      setProject({ ...project, is_favorite: !project.is_favorite });
    } catch { /* noop */ }
  };

  const doShare = async () => {
  if (!project) return;

  const message = `Check out my cinematic ${project.effect_name} FX made with PrankFX!`;
  const imageUri = toDataUri(project.result_image);

  try {
    // =========================
    // WEB
    // =========================
    if (Platform.OS === "web") {
      const nav = globalThis.navigator as Navigator & {
        share?: (data: {
          title?: string;
          text?: string;
          url?: string;
        }) => Promise<void>;
      };

      if (typeof nav?.share === "function") {
        await nav.share({
          title: `PrankFX — ${project.effect_name}`,
          text: message,
        });

        return;
      }

      // Fallback for desktop browsers.
      if (
        typeof document !== "undefined" &&
        typeof document.createElement === "function"
      ) {
        const link = document.createElement("a");

        link.href = imageUri;
        link.download = `prankfx_${project.effect_id}.jpg`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Toast.success("Image downloaded");
        return;
      }

      Toast.error("Sharing is not supported in this browser.");
      return;
    }

    // =========================
    // ANDROID / IOS
    // =========================
    await Share.share({
      message,
      url: imageUri,
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

        {/* Share row */}
        <View style={styles.shareRow}>
          <ShareBtn testID="share-instagram" label="Instagram" icon="logo-instagram" onPress={doShare} />
          <ShareBtn testID="share-tiktok" label="TikTok" icon="musical-notes" onPress={doShare} />
          <ShareBtn testID="share-facebook" label="Facebook" icon="logo-facebook" onPress={doShare} />
          <ShareBtn testID="share-whatsapp" label="WhatsApp" icon="logo-whatsapp" onPress={doShare} />
          <ShareBtn testID="share-telegram" label="Telegram" icon="paper-plane" onPress={doShare} />
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
      onPress={doShare} 
      disabled={loading}
      style={{ flex: 1, opacity: loading ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={colors.brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.saveBtn}
      >
        <Ionicons name="share-outline" size={20} color="#fff" />
        <Text style={[styles.saveText, { color: "#fff" }]}>
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
        Try Another Effect
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
