import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { getEffectName } from "@/src/i18n/effectNames";
import { ProjectListItem, ProjectsAPI } from "@/src/api/client";
import { toDataUri } from "@/src/utils/images";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function History() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProjectListItem[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await ProjectsAPI.list({ favorites: tab === "favorites", search: query || undefined });
      setItems(r.items);
    } catch (e: any) {
      Toast.error(e?.message || "Failed to load");
    }
  }, [tab, query]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFavorite = async (p: ProjectListItem) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await ProjectsAPI.setFavorite(p.project_id, !p.is_favorite);
      setItems((cur) => cur.map((x) => x.project_id === p.project_id ? { ...x, is_favorite: !p.is_favorite } : x));
    } catch { /* noop */ }
  };

  const del = async (p: ProjectListItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      await ProjectsAPI.remove(p.project_id);
      setItems((cur) => cur.filter((x) => x.project_id !== p.project_id));
    } catch { /* noop */ }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: colors.divider }]}>
        <Text style={[styles.h1, { color: colors.onSurface }]}>{t("history")}</Text>

        <View style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="history-search-input"
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder={t("search")}
            placeholderTextColor={colors.onSurfaceTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>

        <View style={styles.tabs}>
          {(["all", "favorites"] as const).map((k) => {
            const isActive = tab === k;
            return (
              <Pressable
                key={k}
                testID={`history-tab-${k}`}
                onPress={() => setTab(k)}
                style={[styles.tab, { borderColor: isActive ? colors.brand : "transparent", backgroundColor: isActive ? colors.brand : colors.surfaceSecondary }]}
              >
                <Text style={[styles.tabText, { color: isActive ? "#fff" : colors.onSurface }]}>
                  {k === "all" ? t("all") : t("favorites")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="film-outline" size={36} color={colors.onSurfaceTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{t("empty_history")}</Text>
          <Text style={[styles.emptySub, { color: colors.onSurfaceTertiary }]}>{t("empty_history_sub")}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.project_id}
          numColumns={2}
          columnWrapperStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.xl }}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom, gap: Spacing.md, paddingTop: Spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              testID={`history-item-${item.project_id}`}
              onPress={() => router.push({ pathname: "/create/result", params: { pid: item.project_id } })}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Image source={{ uri: toDataUri(item.thumbnail) }} style={styles.cardImg} />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={StyleSheet.absoluteFillObject} />
              <Pressable
                testID={`favorite-${item.project_id}`}
                onPress={() => toggleFavorite(item)}
                style={styles.fav}
                hitSlop={10}
              >
                <Ionicons name={item.is_favorite ? "heart" : "heart-outline"} size={20} color={item.is_favorite ? "#FF3B30" : "#fff"} />
              </Pressable>
              <Pressable
                testID={`delete-${item.project_id}`}
                onPress={() => del(item)}
                style={styles.del}
                hitSlop={10}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </Pressable>
              <Text numberOfLines={1} style={styles.name}>
                {getEffectName(item.effect_id, lang, item.effect_name)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  h1: { fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, letterSpacing: -0.5, marginBottom: Spacing.md },
  search: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 44, marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, paddingVertical: 0 },
  tabs: { flexDirection: "row", gap: Spacing.sm },
  tab: { paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1 },
  tabText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  card: { flex: 1, aspectRatio: 0.85, borderRadius: Radius.lg, overflow: "hidden" },
  cardImg: { width: "100%", height: "100%" },
  name: { position: "absolute", left: 12, right: 12, bottom: 12, color: "#fff", fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  fav: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.45)", padding: 6, borderRadius: 999 },
  del: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.45)", padding: 6, borderRadius: 999 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, gap: Spacing.md },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  emptySub: { fontSize: FontSize.base, textAlign: "center" },
});
