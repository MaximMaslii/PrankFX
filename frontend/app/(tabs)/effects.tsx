import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import {
  getEffectCategoryName,
  getEffectDisplayName,
  getEffectName,
} from "@/src/i18n/effectNames";

import { CategoryItem, EffectsAPI } from "@/src/api/client";
import { CreateFlow } from "@/src/utils/createFlow";
import { getEffectThumbSource } from "@/src/utils/images";
import { Skeleton, SkeletonGrid } from "@/src/components/Skeleton";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Tracking,
  glow,
} from "@/src/theme/tokens";

export default function EffectsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [active, setActive] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await EffectsAPI.catalog();
      setCategories(r.categories);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filters = useMemo(() => ([
    {
      id: "all",
      name: getEffectCategoryName("all", lang, t("all")),
      emoji: "✨",
    },
    ...categories.map((c) => ({
      id: c.id,
      name: getEffectCategoryName(c.id, lang, c.name),
      emoji: c.emoji,
    })),
  ]), [categories, lang, t]);

  const flat = useMemo(() => {
    if (active === "all") {
      return categories.flatMap((c) =>
        c.effects.map((e) => ({
          ...e,
          category: c.id,
          premium_tier: e.premium_tier || c.premium_tier,
        }))
      );
    }

    const cat = categories.find((c) => c.id === active);
    if (!cat) return [];

    return cat.effects.map((e) => ({
      ...e,
      category: cat.id,
      premium_tier: e.premium_tier || cat.premium_tier,
    }));
  }, [categories, active]);

  const selectEffect = (e: { id: string; name: string; category: string }) => {
    Haptics.selectionAsync().catch(() => {});

    CreateFlow.setEffect({
      effect_id: e.id,
      effect_name: e.name,
      category: e.category,
    });

    router.push("/create/pick-source");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient
        colors={colors.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header. The count under the title is not decoration — it tells you
          whether a filter narrowed anything before you scroll to find out. */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.md,
            borderColor: colors.divider,
          },
        ]}
      >
        <Text style={[styles.kicker, { color: colors.brand }]}>
          {t("discover")}
        </Text>

        <View style={styles.titleRow}>
          <Text style={[styles.h1, { color: colors.onSurface }]}>
            {t("effects")}
          </Text>

          <Text style={[styles.count, { color: colors.onSurfaceTertiary }]}>
            {flat.length}
          </Text>
        </View>

        {/* The one promise worth making on this screen: the catalogue is not
            finished. Someone who has already tried the effects they liked is
            deciding whether to come back — a date on the grid answers that
            better than any amount of copy elsewhere. */}
        <View
          style={[
            styles.updateBadge,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="sparkles" size={13} color={colors.brand} />

          <Text style={[styles.updateBadgeText, { color: colors.onSurfaceTertiary }]}>
            {t("weekly_effect_updates")}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {/* Placeholder pills in the real chip geometry, so the filter row
              does not pop into existence and shove the grid down. */}
          {loading &&
            [96, 120, 88, 104].map((w, i) => (
              <Skeleton key={i} width={w} height={38} radius={Radius.pill} />
            ))}

          {!loading && filters.map((f) => {
            const isActive = active === f.id;

            return (
              <Pressable
                key={f.id}
                testID={`chip-${f.id}`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActive(f.id);
                }}
                style={[
                  styles.chip,
                  isActive
                    ? [
                        {
                          backgroundColor: colors.brand,
                          borderColor: colors.brand,
                        },
                        glow(colors.glowBrand, "sm"),
                      ]
                    : {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                      },
                ]}
              >
                <Text style={{ fontSize: 13 }}>{f.emoji}</Text>

                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? colors.onBrand : colors.onSurface },
                  ]}
                >
                  {f.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={flat}
        keyExtractor={(e) => e.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.xl }}
        contentContainerStyle={{
          paddingBottom: 140 + insets.bottom,
          gap: Spacing.md,
          paddingTop: Spacing.lg,
        }}
        ListEmptyComponent={
          loading ? (
            <SkeletonGrid count={6} aspectRatio={0.82} />
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="sparkles-outline"
                size={26}
                color={colors.onSurfaceTertiary}
              />
              <Text
                style={[styles.emptyText, { color: colors.onSurfaceTertiary }]}
              >
                {t("no_projects")}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`effect-${item.id}`}
            onPress={() => selectEffect(item)}
            style={[styles.card, { borderColor: colors.border }]}
          >
            <Image
              source={getEffectThumbSource(item.id, item.category)}
              style={styles.cardImg}
            />

            <LinearGradient
              colors={["transparent", "rgba(5,4,12,0.35)", colors.scrim]}
              locations={[0.35, 0.65, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.cardBottom}>
              <Text numberOfLines={2} style={styles.cardName}>
                {getEffectDisplayName(
                  item.id,
                  lang,
                  getEffectName(item.id, lang, item.name)
                )}
              </Text>
            </View>
          </Pressable>
        )}
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

  kicker: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.kicker,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },

  updateBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },

  updateBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  h1: {
    fontSize: FontSize.xl3,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.display,
  },

  count: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },

  chipRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },

  chip: {
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },

  chipText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },

  card: {
    flex: 1,
    aspectRatio: 0.82,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },

  cardImg: {
    width: "100%",
    height: "100%",
  },

  cardBottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },

  cardName: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    lineHeight: 18,
  },

  empty: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl3,
  },

  emptyText: {
    fontSize: FontSize.base,
  },
});
