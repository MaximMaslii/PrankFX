import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { getEffectName } from "@/src/i18n/effectNames";
import { useAuth } from "@/src/auth/AuthProvider";
import { CategoryItem, EffectsAPI } from "@/src/api/client";
import { getCollectionById } from "@/src/utils/collections";
import { getEffectThumb } from "@/src/utils/images";
import { CreateFlow } from "@/src/utils/createFlow";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";
import {
  getCollectionName,
  getCollectionSubtitle,
} from "@/src/i18n/collectionNames";


export default function CollectionScreen() {
  const { colors } = useTheme();
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();

  const collection = useMemo(() => (params.id ? getCollectionById(params.id) : undefined), [params.id]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await EffectsAPI.catalog();
      setCategories(r.categories);
    } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const effects = useMemo(() => {
    if (!collection) return [];
    const out: { id: string; name: string; emoji: string; category: string; premium_tier: string }[] = [];
    for (const eid of collection.effectIds) {
      for (const cat of categories) {
        const found = cat.effects.find((e) => e.id === eid);
        if (found) {
          out.push({ ...found, category: cat.id, premium_tier: cat.premium_tier });
          break;
        }
      }
    }
    return out;
  }, [collection, categories]);

  const isLocked = (premium_tier: string) => {
    if (premium_tier === "face_effects") return !(user?.premium_tier === "face_effects" || user?.premium_tier === "ultimate");
    if (premium_tier === "ultimate") return user?.premium_tier !== "ultimate";
    return false;
  };

  const pick = (e: (typeof effects)[number]) => {
    if (isLocked(e.premium_tier)) {
      router.push("/premium");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    CreateFlow.setEffect({ effect_id: e.id, effect_name: e.name, category: e.category });
    router.push("/create/pick-source");
  };

  if (!collection) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.onSurface }}>{t("collection_not_found")}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Hero */}
      <View style={styles.hero}>
        <Image source={{ uri: collection.hero }} style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={[collection.accent[0] + "00", collection.accent[0] + "CC", collection.accent[1] + "F5"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable testID="collection-back" onPress={() => router.back()} style={[styles.back, { top: insets.top + 8 }]}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.heroText}>
          <View style={styles.chip}>
            <Ionicons name="sparkles" size={12} color="#fff" />
            <Text style={styles.chipText}>{collection.effectIds.length} FX</Text>
          </View>
          <Text style={styles.heroTitle}>
            {getCollectionName(collection.id, lang, collection.title)}
          </Text>

          <Text style={styles.heroSub}>
            {getCollectionSubtitle(collection.id, lang, collection.subtitle)}
          </Text>
        </View>
      </View>

      {/* Grid */}
      <FlatList
        data={effects}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.xl }}
        contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: 120 + insets.bottom, gap: Spacing.md }}
        renderItem={({ item }) => {
          const locked = isLocked(item.premium_tier);
          return (
            <Pressable
              testID={`collection-effect-${item.id}`}
              onPress={() => pick(item)}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Image source={{ uri: getEffectThumb(item.id, item.category) }} style={StyleSheet.absoluteFillObject} />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFillObject} />
              {locked && (
                <View style={styles.lock}>
                  <Ionicons name="lock-closed" size={12} color="#fff" />
                </View>
              )}
              <View style={styles.cardBottom}>
                <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                <Text numberOfLines={2} style={styles.cardName}>
                  {getEffectName(item.id, lang, item.name)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 260, position: "relative" },
  back: {
    position: "absolute",
    left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  heroText: { position: "absolute", left: Spacing.xl, right: Spacing.xl, bottom: Spacing.xl },
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  chipText: { color: "#fff", fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  heroTitle: { color: "#fff", fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, letterSpacing: -0.5 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: FontSize.md, marginTop: 4 },
  card: { flex: 1, aspectRatio: 0.85, borderRadius: Radius.lg, overflow: "hidden" },
  cardBottom: { position: "absolute", left: 12, right: 12, bottom: 10 },
  cardName: { color: "#fff", fontSize: FontSize.base, fontWeight: FontWeight.bold, marginTop: 2 },
  lock: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.55)", padding: 6, borderRadius: 999 },
});
