import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import {
  getEffectDisplayName,
  getEffectName,
} from "@/src/i18n/effectNames";

import { useAuth } from "@/src/auth/AuthProvider";
import {
  CategoryItem,
  CreditsInfo,
  EffectItem,
  EffectsAPI,
  ProjectListItem,
  ProjectsAPI,
  SnapAPI,
  SnapJob,
  SubAPI,
} from "@/src/api/client";
import {
  SNAP_HERO_EFFECTS,
  snapCopy,
  snapEmojiFor,
  snapGradientFor,
} from "@/src/utils/snapEffects";
import { HookTitle } from "@/src/components/HookTitle";
import { CreateFlow } from "@/src/utils/createFlow";
import { pickFromGallery, takePhoto } from "@/src/utils/picker";
import { getEffectThumbSource, toDataUri } from "@/src/utils/images";
import { getDailyEffectId } from "@/src/utils/collections";
import { Skeleton, SkeletonRow } from "@/src/components/Skeleton";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Tracking,
  glow,
  shadow,
} from "@/src/theme/tokens";

export default function Home() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ paywall?: string }>();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [snaps, setSnaps] = useState<SnapJob[]>([]);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Only the FIRST load shows skeletons. The screen reloads on every focus,
  // and flashing placeholders over content the user is already looking at is
  // worse than showing slightly stale data for a second.
  const [firstLoad, setFirstLoad] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cat, projs] = await Promise.all([
        EffectsAPI.catalog(),
        ProjectsAPI.list({}),
      ]);

      setCategories(cat.categories);
      setProjects(projs.items.slice(0, 12));
    } catch {
      // Keep Home usable even if one non-critical request fails.
    } finally {
      setFirstLoad(false);
    }

    try {
      const cred = await SubAPI.credits();
      setCredits(cred);
    } catch {
      setCredits(null);
    }

    // "My videos" — the clips people come back to share. Failed ones are
    // left out: they were refunded and there is nothing to watch.
    try {
      const [list, headers] = await Promise.all([
        SnapAPI.list(),
        SnapAPI.authHeaders(),
      ]);
      setSnaps(list.items.filter((j) => j.status !== "failed").slice(0, 12));
      setAuthHeaders(headers);
    } catch {
      // Non-critical row.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (params.paywall === "1") {
      // Clear the param first so it cannot re-fire on the next focus.
      router.setParams({ paywall: undefined });

      router.push({
        pathname: "/paywall",
        params: { reason: "no_fx" },
      });
    }
  }, [params.paywall, router]);

  // The app's real currency is `fx_credits`. The old code gated on the legacy
  // `free_credits_remaining`, which nothing ever decrements — so the paywall
  // never appeared and users were sent into a generation that failed with 402,
  // while anyone who *bought* FX could still be told they had none left.
  const fxCredits = credits?.fx_credits ?? user?.fx_credits ?? 0;

  const noCreditsLeft = fxCredits <= 0;

  // There used to be a `setPaywallOpen(true)` here with no state behind it,
  // so tapping "Take photo" with an empty balance threw a ReferenceError and
  // did nothing. The paywall is a route.
  const openPaywall = useCallback(() => {
    router.push({
      pathname: "/paywall",
      params: { reason: "no_fx" },
    });
  }, [router]);

  const allEffects = useMemo(() => {
    const map: Record<
      string,
      EffectItem & { category: string }
    > = {};

    for (const c of categories) {
      for (const e of c.effects) {
        map[e.id] = {
          ...e,
          category: c.id,
        };
      }
    }

    return map;
  }, [categories]);

  const dailyEffect = useMemo(() => {
    const id = getDailyEffectId();
    return allEffects[id] || null;
  }, [allEffects]);

  const popular = useMemo(() => {
    const face = categories.find(
      (c) => c.id === "face"
    );

    return face?.effects.slice(0, 10) || [];
  }, [categories]);

  const startFlow = async (
    source: "camera" | "gallery"
  ) => {
    if (noCreditsLeft) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning
      ).catch(() => { });

      openPaywall();
      return;
    }

    Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    ).catch(() => { });

    const pick =
      source === "camera"
        ? await takePhoto()
        : await pickFromGallery();

    if (!pick) return;

    CreateFlow.setSource(
      pick.base64,
      pick.mime
    );

    router.push("/create/pick-effect");
  };

  const openEffect = (
    effectId: string,
    effectName: string,
    category: string
  ) => {
    if (noCreditsLeft) {
      openPaywall();
      return;
    }

    CreateFlow.setEffect({
      effect_id: effectId,
      effect_name: effectName,
      category,
    });

    router.push("/create/pick-source");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Aurora — the page background is never a flat colour. Two blurred
          washes at the top corners give the screen a light source, which is
          what makes the dark cards read as objects rather than holes. */}
      <LinearGradient
        colors={colors.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          styles.wash,
          { backgroundColor: colors.violet, top: -180, left: -120 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.wash,
          { backgroundColor: colors.accent, top: -140, right: -140 },
        ]}
      />

      <ScrollView
        testID="home-screen"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 140 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surfaceSecondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.hi,
                { color: colors.onSurfaceTertiary },
              ]}
            >
              {t("hi")}, {user?.name || { ru: "друг", de: "Freund", en: "friend" }[lang]} 👋
            </Text>

            <Text
              style={[
                styles.lead,
                { color: colors.onSurface },
              ]}
            >
              {t("home_lead")}
            </Text>
          </View>

          <Pressable
            testID="home-avatar"
            onPress={() => router.push("/settings")}
            style={[
              styles.avatarRing,
              { borderColor: colors.brand },
            ]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.surfaceTertiary },
              ]}
            >
              {user?.picture ? (
                <Image
                  source={{ uri: user.picture }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              ) : (
                <Text
                  style={[styles.avatarText, { color: colors.onSurface }]}
                >
                  {(user?.name || user?.email || "P")[0].toUpperCase()}
                </Text>
              )}
            </View>
          </Pressable>
        </View>

        {/* The hook. First thing under the greeting, because the first two
            seconds decide whether someone scrolls or leaves: a promise
            ("you've never tried this"), proof (the effects parading past),
            and one obvious button. */}
        <View style={{ paddingHorizontal: Spacing.xl }}>
          <Pressable
            testID="home-snap-card"
            onPress={() => router.push("/create/snap-effect")}
            style={({ pressed }) => pressed && { transform: [{ scale: 0.985 }] }}
          >
            <LinearGradient
              colors={colors.snapGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.snapCard, glow(colors.violet, "md")]}
            >
              <Text style={styles.snapKicker}>{t("snap_hook_kicker")}</Text>
              <HookTitle size={26} style={{ marginTop: 4 }} />
              <Text style={styles.snapSub}>{t("snap_hook_sub")}</Text>

              <EffectMarquee label={(id) => t(`snap_fx_${id}` as any)} />

              <View style={styles.snapCtaRow}>
                <View style={styles.snapCta}>
                  <Text style={{ fontSize: 15 }}>🔥</Text>
                  <Text style={styles.snapCtaText}>{t("snap_hook_cta")}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#0D0B1A" />
                </View>
                <Text style={styles.snapPrice}>10 FX · {t("snap_five_sec")}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* FX wallet — magenta, because in this app magenta means "costs
            money". The number is the biggest thing on the card: balance is
            the one fact people open this row to read. */}
        {(credits || user) && (
          <Pressable
            testID="home-fx-balance"
            onPress={() => router.push("/premium")}
            style={[
              styles.wallet,
              shadow("sm"),
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: noCreditsLeft ? colors.accent : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.walletIcon,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <Ionicons name="flash" size={16} color={colors.accent} />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[styles.walletLabel, { color: colors.onSurfaceTertiary }]}
              >
                {t("fx_balance")}
              </Text>

              <Text style={[styles.walletSub, { color: colors.onSurfaceTertiary }]}>
                {noCreditsLeft ? t("fx_empty_hint") : t("fx_rate_hint")}
              </Text>
            </View>

            <Text style={[styles.walletAmount, { color: colors.onSurface }]}>
              {fxCredits}
            </Text>

            <View
              style={[
                styles.walletCta,
                { backgroundColor: colors.accent },
              ]}
            >
              <Ionicons name="add" size={16} color={colors.onAccent} />
            </View>
          </Pressable>
        )}

        {/* Primary actions. Exactly one of them is lime: the camera is what
            the app is for, uploading is the alternative. */}
        <View style={styles.actions}>
          <Pressable
            testID="home-take-photo"
            onPress={() => startFlow("camera")}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={colors.brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionCard, glow(colors.glowBrand, "sm")]}
            >
              <View style={styles.actionIconDark}>
                <Ionicons name="camera" size={20} color={colors.onBrand} />
              </View>

              <Text style={[styles.actionText, { color: colors.onBrand }]}>
                {t("take_photo")}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            testID="home-upload-photo"
            onPress={() => startFlow("gallery")}
            style={{ flex: 1 }}
          >
            <View
              style={[
                styles.actionCard,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.surfaceTertiary },
                ]}
              >
                <Ionicons name="image" size={20} color={colors.onSurface} />
              </View>

              <Text style={[styles.actionText, { color: colors.onSurface }]}>
                {t("upload_photo")}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* My videos */}
        {snaps.length > 0 && (
          <>
            <SectionHeader title={t("snap_my_videos")} />

            <FlatList
              data={snaps}
              keyExtractor={(j) => j.job_id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.md }}
              renderItem={({ item }) => {
                const ready = item.status === "completed";

                return (
                  <Pressable
                    testID={`snap-video-${item.job_id}`}
                    disabled={!ready}
                    onPress={() =>
                      router.push({ pathname: "/create/snap-result", params: { jid: item.job_id } })
                    }
                    style={[styles.recentCard, { borderColor: colors.border }]}
                  >
                    <LinearGradient
                      colors={snapGradientFor(item.effect_id)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[StyleSheet.absoluteFillObject, styles.videoFallback]}
                    >
                      <Text style={{ fontSize: 36 }}>{snapEmojiFor(item.effect_id)}</Text>
                    </LinearGradient>

                    {ready && (
                      <Image
                        source={{ uri: SnapAPI.posterUrl(item.job_id), headers: authHeaders }}
                        style={styles.recentImg}
                        contentFit="cover"
                      />
                    )}

                    <LinearGradient
                      colors={["transparent", colors.scrim]}
                      locations={[0.45, 1]}
                      style={StyleSheet.absoluteFillObject}
                    />

                    <View style={styles.videoBadge}>
                      <Ionicons name={ready ? "play" : "time"} size={12} color="#fff" />
                    </View>

                    <Text numberOfLines={1} style={styles.recentName}>
                      {ready
                        ? snapCopy(t, lang, item.effect_id, "title", undefined, item.effect_name)
                        : t("snap_status_processing")}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </>
        )}

        {/* Effect of the Day */}
        {firstLoad && !dailyEffect && (
          <View
            style={{
              marginTop: Spacing.xl2,
              paddingHorizontal: Spacing.xl,
              gap: Spacing.sm,
            }}
          >
            <Skeleton width={140} height={12} radius={Radius.sm} />
            <Skeleton width="100%" height={220} radius={Radius.lg} />
          </View>
        )}

        {dailyEffect && (
          <View
            style={{
              marginTop: Spacing.xl2,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View style={styles.sectionInline}>
              <Ionicons name="flash" size={14} color={colors.brand} />

              <Text style={[styles.sectionKicker, { color: colors.brand }]}>
                {t("effect_of_the_day")}
              </Text>
            </View>

            <Pressable
              testID={`daily-${dailyEffect.id}`}
              onPress={() =>
                openEffect(
                  dailyEffect.id,
                  dailyEffect.name,
                  dailyEffect.category
                )
              }
              style={[
                styles.daily,
                shadow("md"),
                { borderColor: colors.border },
              ]}
            >
              <Image
                source={getEffectThumbSource(
                  dailyEffect.id,
                  dailyEffect.category
                )}
                style={StyleSheet.absoluteFillObject}
              />

              <LinearGradient
                colors={["transparent", "rgba(5,4,12,0.55)", colors.scrim]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFillObject}
              />

              <View style={styles.dailyBottom}>
                <View style={styles.dailyBadge}>
                  <Ionicons name="sparkles" size={11} color="#fff" />

                  <Text style={styles.dailyBadgeText}>{t("todays_pick")}</Text>
                </View>

                <Text style={styles.dailyName}>
                  {getEffectName(dailyEffect.id, lang, dailyEffect.name)}
                </Text>

                <Text style={styles.dailySub}>{t("tap_to_try_effect")}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Popular effects */}
        <SectionHeader
          title={t("popular_effects")}
          action={t("view_all")}
          onAction={() => router.push("/effects")}
        />

        {firstLoad && popular.length === 0 ? (
          <SkeletonRow count={3} width={136} height={180} />
        ) : (
        <FlatList
          data={popular}
          keyExtractor={(e) => e.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Spacing.xl,
            gap: Spacing.md,
          }}
          renderItem={({ item }) => (
            <Pressable
              testID={`popular-${item.id}`}
              onPress={() => openEffect(item.id, item.name, "face")}
              style={[
                styles.popularCard,
                { borderColor: colors.border },
              ]}
            >
              <Image
                source={getEffectThumbSource(item.id, "face")}
                style={styles.popularImg}
              />

              <LinearGradient
                colors={["transparent", colors.scrim]}
                locations={[0.4, 1]}
                style={StyleSheet.absoluteFillObject}
              />

              <View style={styles.popularBottom}>
                <Text numberOfLines={2} style={styles.popularName}>
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
        )}

        {/* Recent projects */}
        <SectionHeader
          title={t("recent_projects")}
          action={projects.length > 0 ? t("view_all") : undefined}
          onAction={() => router.push("/history")}
        />

        {firstLoad && projects.length === 0 ? (
          <SkeletonRow count={3} width={128} height={160} />
        ) : projects.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.surfaceTertiary },
              ]}
            >
              <Ionicons
                name="film-outline"
                size={22}
                color={colors.onSurfaceTertiary}
              />
            </View>

            <Text
              style={[styles.emptyText, { color: colors.onSurfaceTertiary }]}
            >
              {t("no_projects")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={projects}
            keyExtractor={(p) => p.project_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: Spacing.xl,
              gap: Spacing.md,
            }}
            renderItem={({ item }) => (
              <Pressable
                testID={`recent-${item.project_id}`}
                onPress={() =>
                  router.push({
                    pathname: "/create/result",
                    params: { pid: item.project_id },
                  })
                }
                style={[
                  styles.recentCard,
                  { borderColor: colors.border },
                ]}
              >
                <Image
                  source={{ uri: toDataUri(item.thumbnail) }}
                  style={styles.recentImg}
                />

                <LinearGradient
                  colors={["transparent", colors.scrim]}
                  locations={[0.45, 1]}
                  style={StyleSheet.absoluteFillObject}
                />

                <Text numberOfLines={1} style={styles.recentName}>
                  {item.effect_name}
                </Text>
              </Pressable>
            )}
          />
        )}

      </ScrollView>
    </View>
  );
}

/**
 * The photo effects drifting past in a loop — proof, in motion, that the
 * promise above it is real. Two copies of the row slide left by exactly one
 * copy's width, so the seam never shows.
 */
function EffectMarquee({ label }: { label: (id: string) => string }) {
  const shift = useRef(new Animated.Value(0)).current;
  const [rowWidth, setRowWidth] = useState(0);

  useEffect(() => {
    if (!rowWidth) return;

    shift.setValue(0);

    const loop = Animated.loop(
      Animated.timing(shift, {
        toValue: -rowWidth,
        duration: rowWidth * 28,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [rowWidth, shift]);

  const row = (copy: number) => (
    <View
      style={styles.marqueeRow}
      onLayout={copy === 0 ? (e) => setRowWidth(e.nativeEvent.layout.width) : undefined}
    >
      {SNAP_HERO_EFFECTS.map((id) => (
        <View key={`${copy}-${id}`} style={styles.marqueeChip}>
          <Text style={styles.marqueeEmoji}>{snapEmojiFor(id)}</Text>
          <Text style={styles.marqueeText}>{label(id)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.marquee} pointerEvents="none">
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: shift }] }}>
        {row(0)}
        {row(1)}
      </Animated.View>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
        {title}
      </Text>

      {action ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.sectionLink}>
          <Text
            style={[styles.sectionAction, { color: colors.onSurfaceTertiary }]}
          >
            {action}
          </Text>

          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.onSurfaceTertiary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.16,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },

  hi: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    marginBottom: 4,
  },

  lead: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
    maxWidth: 260,
  },

  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },

  wallet: {
    marginTop: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  walletIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  walletLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: Tracking.kicker,
    textTransform: "uppercase",
  },

  walletSub: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },

  walletAmount: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
  },

  walletCta: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  actions: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },

  actionCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    minHeight: 112,
    justifyContent: "space-between",
  },

  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  actionIconDark: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,11,26,0.12)",
  },

  actionText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: Tracking.title,
    marginTop: Spacing.md,
  },

  snapCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: 6,
    overflow: "hidden",
  },

  snapBadge: {
    position: "absolute",
    top: Spacing.lg,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(5,4,12,0.32)",
  },

  snapBadgeText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.kicker,
  },

  snapKicker: {
    color: "rgba(255,255,255,0.9)",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.kicker,
    marginTop: Spacing.xs,
  },

  snapTitle: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 33,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.display,
    maxWidth: 300,
  },

  snapCtaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: Spacing.md,
    rowGap: Spacing.sm,
    marginTop: Spacing.md,
  },

  snapPrice: {
    flexShrink: 0,
    color: "rgba(255,255,255,0.9)",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  marquee: {
    marginTop: Spacing.md,
    marginHorizontal: -Spacing.xl,
    overflow: "hidden",
  },

  marqueeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },

  marqueeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(5,4,12,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },

  marqueeEmoji: { fontSize: 16 },

  marqueeText: { color: "#fff", fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  videoFallback: { alignItems: "center", justifyContent: "center" },

  videoBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,4,12,0.55)",
  },

  snapSub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: FontSize.base,
    lineHeight: 19,
  },

  snapCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    borderRadius: Radius.pill,
    backgroundColor: "#FFFFFF",
  },

  snapCtaText: {
    color: "#0D0B1A",
    fontSize: FontSize.md,
    fontWeight: FontWeight.heavy,
  },

  sectionInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },

  sectionKicker: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.kicker,
  },

  daily: {
    height: 220,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },

  dailyBottom: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
  },

  dailyBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
  },

  dailyBadgeText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
  },

  dailyName: {
    color: "#fff",
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.display,
  },

  dailySub: {
    color: "rgba(255,255,255,0.86)",
    fontSize: FontSize.sm,
    marginTop: 4,
  },

  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl2,
    marginBottom: Spacing.md,
  },

  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
  },

  sectionLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  sectionAction: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },

  popularCard: {
    width: 136,
    height: 180,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },

  popularImg: {
    width: "100%",
    height: "100%",
  },

  popularBottom: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },

  popularName: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    lineHeight: 17,
  },

  recentCard: {
    width: 128,
    height: 160,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },

  recentImg: {
    width: "100%",
    height: "100%",
  },

  recentName: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    color: "#fff",
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  empty: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: Spacing.xl2,
    alignItems: "center",
    gap: Spacing.md,
  },

  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
});
