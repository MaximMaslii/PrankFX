import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { CategoryItem, EffectsAPI } from "@/src/api/client";
import { CreateFlow } from "@/src/utils/createFlow";
import { getEffectThumb } from "@/src/utils/images";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function EffectsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [active, setActive] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const r = await EffectsAPI.catalog();
      setCategories(r.categories);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filters = useMemo(() => ([
    { id: "all", name: t("all"), emoji: "✨" },
    ...categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
  ]), [categories, t]);

  const flat = useMemo(() => {
    if (active === "all") {
      return categories.flatMap((c) => c.effects.map((e) => ({ ...e, category: c.id, premium_tier: c.premium_tier })));
    }
    const cat = categories.find((c) => c.id === active);
    if (!cat) return [];
    return cat.effects.map((e) => ({ ...e, category: cat.id, premium_tier: cat.premium_tier }));
  }, [categories, active]);

  const isLocked = (premium_tier: string) => {
    if (!premium_tier) return false;
    if (premium_tier === "face_effects") return !(user?.premium_tier === "face_effects" || user?.premium_tier === "ultimate");
    if (premium_tier === "ultimate") return user?.premium_tier !== "ultimate";
    return false;
  };

  const selectEffect = (e: { id: string; name: string; category: string; premium_tier: string }) => {
    if (isLocked(e.premium_tier)) {
      router.push("/(tabs)/premium");
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    CreateFlow.setEffect({ effect_id: e.id, effect_name: e.name, category: e.category });
    router.push("/create/pick-source");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <Text style={[styles.h1, { color: colors.onSurface }]}>{t("effects")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {filters.map((f) => {
            const isActive = active === f.id;
            return (
              <Pressable
                key={f.id}
                testID={`chip-${f.id}`}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setActive(f.id); }}
                style={[
                  styles.chip,
                  { borderColor: isActive ? colors.brand : colors.border, backgroundColor: isActive ? colors.brand : colors.surfaceSecondary },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{f.emoji}</Text>
                <Text style={[styles.chipText, { color: isActive ? "#fff" : colors.onSurface }]}>{f.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={flat}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.xl }}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom, gap: Spacing.md, paddingTop: Spacing.md }}
        renderItem={({ item }) => {
          const locked = isLocked(item.premium_tier);
          return (
            <Pressable
              testID={`effect-${item.id}`}
              onPress={() => selectEffect(item)}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Image source={{ uri: getEffectThumb(item.id, item.category) }} style={styles.cardImg} />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={StyleSheet.absoluteFillObject} />
              {locked && (
                <View style={styles.lock}>
                  <Ionicons name="lock-closed" size={12} color="#fff" />
                  <Text style={styles.lockText}>{t("premium")}</Text>
                </View>
              )}
              <View style={styles.cardBottom}>
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                <Text numberOfLines={2} style={styles.cardName}>{item.name}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  h1: { fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, letterSpacing: -0.5, marginBottom: Spacing.md },
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.xl },
  chip: {
    height: 36, minWidth: 60, borderRadius: Radius.pill, borderWidth: 1,
    paddingHorizontal: Spacing.md, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6, flexShrink: 0,
  },
  chipText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  card: { flex: 1, aspectRatio: 0.85, borderRadius: Radius.lg, overflow: "hidden" },
  cardImg: { width: "100%", height: "100%" },
  cardBottom: { position: "absolute", left: 12, right: 12, bottom: 12 },
  cardName: { color: "#fff", fontSize: FontSize.base, fontWeight: FontWeight.bold, marginTop: 4 },
  lock: {
    position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  lockText: { color: "#fff", fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
});
