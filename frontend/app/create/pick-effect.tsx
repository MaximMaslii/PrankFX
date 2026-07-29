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
import { getEffectThumb, toDataUri } from "@/src/utils/images";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function PickEffect() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [active, setActive] = useState<string>("face");
  const source = CreateFlow.getSource();

  const load = useCallback(async () => {
    try {
      const r = await EffectsAPI.catalog();
      setCategories(r.categories);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const cat = categories.find((c) => c.id === active);
    if (!cat) return [];
    return cat.effects.map((e) => ({ ...e, premium_tier: cat.premium_tier }));
  }, [categories, active]);

  const isLocked = (premium_tier: string) => {
    if (premium_tier === "face_effects") return !(user?.premium_tier === "face_effects" || user?.premium_tier === "ultimate");
    if (premium_tier === "ultimate") return user?.premium_tier !== "ultimate";
    return false;
  };

  const pick = (e: any) => {
    if (isLocked(e.premium_tier)) {
      router.push("/premium");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    CreateFlow.setEffect({ effect_id: e.id, effect_name: e.name, category: active });
    router.push("/create/processing");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: colors.divider }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
          <Pressable testID="pick-effect-back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={[styles.h1, { color: colors.onSurface }]}>Choose effect</Text>
        </View>

        {source?.base64 ? (
          <Image
            source={{ uri: toDataUri(source.base64, source.mime) }}
            style={styles.preview}
            contentFit="cover"
          />
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {categories.map((c) => {
            const a = active === c.id;
            return (
              <Pressable
                key={c.id}
                testID={`create-chip-${c.id}`}
                onPress={() => setActive(c.id)}
                style={[styles.chip, { borderColor: a ? colors.brand : colors.border, backgroundColor: a ? colors.brand : colors.surfaceSecondary }]}
              >
                <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                <Text style={{ color: a ? "#fff" : colors.onSurface, fontWeight: FontWeight.semibold }}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.xl }}
        contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: 60 + insets.bottom, gap: Spacing.md }}
        renderItem={({ item }) => {
          const locked = isLocked(item.premium_tier);
          return (
            <Pressable
              testID={`create-effect-${item.id}`}
              onPress={() => pick(item)}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Image source={{ uri: getEffectThumb(item.id, active) }} style={styles.cardImg} />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFillObject} />
              {locked && (
                <View style={styles.lock}>
                  <Ionicons name="lock-closed" size={12} color="#fff" />
                </View>
              )}
              <View style={styles.cardBottom}>
                <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
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
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { padding: 6 },
  h1: { fontSize: FontSize.xl2, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
  preview: { width: "100%", height: 180, borderRadius: Radius.lg, marginTop: Spacing.md, marginBottom: Spacing.md },
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.xl },
  chip: {
    height: 36, borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Spacing.md,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, flexShrink: 0,
  },
  card: { flex: 1, aspectRatio: 0.85, borderRadius: Radius.lg, overflow: "hidden" },
  cardImg: { width: "100%", height: "100%" },
  cardBottom: { position: "absolute", left: 12, right: 12, bottom: 10 },
  cardName: { color: "#fff", fontSize: FontSize.base, fontWeight: FontWeight.bold, marginTop: 2 },
  lock: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.55)", padding: 6, borderRadius: 999 },
});
