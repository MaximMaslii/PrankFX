import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { CategoryItem, EffectsAPI, ProjectListItem, ProjectsAPI } from "@/src/api/client";
import { CreateFlow } from "@/src/utils/createFlow";
import { pickFromGallery, takePhoto } from "@/src/utils/picker";
import { getEffectThumb, toDataUri } from "@/src/utils/images";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function Home() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cat, projs] = await Promise.all([EffectsAPI.catalog(), ProjectsAPI.list({})]);
      setCategories(cat.categories);
      setProjects(projs.items.slice(0, 12));
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const popular = useMemo(() => {
    // First 8 from the face category as the "popular" strip.
    const face = categories.find((c) => c.id === "face");
    return face?.effects.slice(0, 8) || [];
  }, [categories]);

  const startFlow = async (source: "camera" | "gallery") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const pick = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (!pick) return;
    CreateFlow.setSource(pick.base64, pick.mime);
    router.push("/create/pick-effect");
  };

  const openPopular = (effectId: string, effectName: string) => {
    CreateFlow.setEffect({ effect_id: effectId, effect_name: effectName, category: "face" });
    router.push("/(tabs)/effects");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      testID="home-screen"
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 + insets.bottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.hi, { color: colors.onSurfaceTertiary }]}>{t("hi")}, {user?.name || "friend"} 👋</Text>
          <Text style={[styles.lead, { color: colors.onSurface }]}>{t("home_lead")}</Text>
        </View>
        <Pressable testID="home-avatar" onPress={() => router.push("/(tabs)/settings")}
          style={[styles.avatar, { backgroundColor: colors.brand }]}
        >
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          ) : (
            <Text style={styles.avatarText}>{(user?.name || user?.email || "P")[0].toUpperCase()}</Text>
          )}
        </Pressable>
      </View>

      {/* Primary actions */}
      <View style={styles.actions}>
        <ActionCard
          testID="home-take-photo"
          label={t("take_photo")}
          icon="camera"
          gradient={colors.brandGradient}
          onPress={() => startFlow("camera")}
        />
        <ActionCard
          testID="home-upload-photo"
          label={t("upload_photo")}
          icon="image"
          gradient={["#2C2C2E", "#1C1C1E"]}
          onPress={() => startFlow("gallery")}
        />
      </View>

      {/* Premium banner */}
      {!user?.is_premium && (
        <Pressable testID="home-premium-banner" onPress={() => router.push("/(tabs)/premium")}
          style={{ marginHorizontal: Spacing.xl, marginTop: Spacing.xl }}
        >
          <LinearGradient
            colors={colors.premiumGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.premium}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>{t("premium_banner_title")}</Text>
              <Text style={styles.premiumSub}>{t("premium_banner_sub")}</Text>
            </View>
            <View style={styles.premiumBtn}>
              <Text style={styles.premiumBtnText}>{t("upgrade")}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {/* Popular effects */}
      <SectionHeader title={t("popular_effects")} action={t("view_all")} onAction={() => router.push("/(tabs)/effects")} />
      <FlatList
        data={popular}
        keyExtractor={(e) => e.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.md }}
        renderItem={({ item }) => (
          <Pressable
            testID={`popular-${item.id}`}
            onPress={() => openPopular(item.id, item.name)}
            style={[styles.popularCard, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Image source={{ uri: getEffectThumb(item.id, "face") }} style={styles.popularImg} />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.8)"]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.popularBottom}>
              <Text style={styles.popularEmoji}>{item.emoji}</Text>
              <Text numberOfLines={1} style={styles.popularName}>{item.name}</Text>
            </View>
          </Pressable>
        )}
      />

      {/* Recent projects */}
      <SectionHeader title={t("recent_projects")} action={projects.length > 0 ? t("view_all") : undefined} onAction={() => router.push("/(tabs)/history")} />
      {projects.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Ionicons name="film-outline" size={28} color={colors.onSurfaceTertiary} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceTertiary }]}>{t("no_projects")}</Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.project_id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              testID={`recent-${item.project_id}`}
              onPress={() => router.push({ pathname: "/create/result", params: { pid: item.project_id } })}
              style={[styles.recentCard, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Image source={{ uri: toDataUri(item.thumbnail) }} style={styles.recentImg} />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.75)"]}
                style={StyleSheet.absoluteFillObject}
              />
              <Text numberOfLines={1} style={styles.recentName}>{item.effect_name}</Text>
            </Pressable>
          )}
        />
      )}
    </ScrollView>
  );
}

function ActionCard({ label, icon, gradient, onPress, testID }:
  { label: string; icon: any; gradient: [string, string]; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionCard}>
        <Ionicons name={icon} size={30} color="#fff" />
        <Text style={styles.actionText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={[styles.sectionAction, { color: colors.brand }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  hi: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginBottom: 4 },
  lead: { fontSize: FontSize.xl2, fontWeight: FontWeight.bold, letterSpacing: -0.3, maxWidth: 260 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  actions: { flexDirection: "row", paddingHorizontal: Spacing.xl, gap: Spacing.md },
  actionCard: {
    borderRadius: Radius.lg, padding: Spacing.xl, minHeight: 140,
    justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  actionText: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: 8 },
  premium: {
    flexDirection: "row", alignItems: "center", gap: Spacing.md,
    padding: Spacing.lg, borderRadius: Radius.lg,
    shadowColor: "#FF6B4A", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  premiumTitle: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  premiumSub: { color: "rgba(255,255,255,0.9)", fontSize: FontSize.sm, marginTop: 2 },
  premiumBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.28)", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  premiumBtnText: { color: "#fff", fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.xl, marginTop: Spacing.xl2, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, letterSpacing: -0.2 },
  sectionAction: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  popularCard: { width: 140, height: 180, borderRadius: Radius.lg, overflow: "hidden" },
  popularImg: { width: "100%", height: "100%" },
  popularBottom: { position: "absolute", left: 10, right: 10, bottom: 10 },
  popularEmoji: { fontSize: 20 },
  popularName: { color: "#fff", fontSize: FontSize.base, fontWeight: FontWeight.semibold, marginTop: 2 },
  recentCard: { width: 130, height: 160, borderRadius: Radius.lg, overflow: "hidden" },
  recentImg: { width: "100%", height: "100%" },
  recentName: { position: "absolute", left: 10, right: 10, bottom: 10, color: "#fff", fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  empty: {
    marginHorizontal: Spacing.xl, borderRadius: Radius.lg, borderWidth: 1, borderStyle: "dashed",
    padding: Spacing.xl, alignItems: "center", gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
});
