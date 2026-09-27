/**
 * Step 1 of the Snap flow — pick an effect.
 *
 * Two families live here:
 *   • "From a photo" (PixVerse v5.5): one picture becomes a 5-second clip.
 *     These are the headline — nobody has to perform anything on camera.
 *   • "Record it yourself" (Decart Lucy): the original snap-your-fingers
 *     format, now just the fire effect.
 *
 * The screen opens on a hook, not on a list: the first second has to answer
 * "why would I tap anything here?" before it asks the user to choose.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { SnapAPI, SnapEffect, SubAPI } from "@/src/api/client";
import { SnapFlow } from "@/src/utils/createFlow";
import { pickFromGallery, takePhoto } from "@/src/utils/picker";
import { Toast } from "@/src/components/Toast";
import { isAdultConfirmed } from "@/src/utils/ageGate";
import { snapCopy, snapGradientFor, snapInput } from "@/src/utils/snapEffects";
import { HookTitle } from "@/src/components/HookTitle";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Tracking,
  glow,
} from "@/src/theme/tokens";

export default function SnapEffectPicker() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [effects, setEffects] = useState<SnapEffect[]>([]);
  const [cost, setCost] = useState(10);
  const [loading, setLoading] = useState(true);
  const [sheetFor, setSheetFor] = useState<SnapEffect | null>(null);
  const [picking, setPicking] = useState(false);

  // Answered on first launch. Defaults to true so nothing is hidden before
  // the answer is read back from storage.
  const [adult, setAdult] = useState(true);

  // One shared clock for every floating emoji — cheaper than an animation per
  // tile, and the alternating phase keeps the grid from bobbing in unison.
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    floatLoop.start();
    pulseLoop.start();
    return () => { floatLoop.stop(); pulseLoop.stop(); };
  }, [float, pulse]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await SnapAPI.catalog();
      setEffects(catalog.effects);
      setCost(catalog.fx_cost);
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let mounted = true;

    isAdultConfirmed().then((value) => {
      if (mounted) setAdult(value);
    });

    return () => { mounted = false; };
  }, []);

  // Saying "I'm under 18" in the first-launch notice has to mean something,
  // otherwise it is theatre: the restricted looks are simply not listed.
  const visible = useMemo(
    () => effects.filter((e) => adult || !e.age_restricted),
    [effects, adult],
  );

  const photoEffects = useMemo(() => visible.filter((e) => snapInput(e) === "photo"), [visible]);
  const recordEffects = useMemo(() => visible.filter((e) => snapInput(e) === "video"), [visible]);

  const hiddenCount = effects.length - visible.length;

  const remember = (effect: SnapEffect) => {
    SnapFlow.setEffect({
      effect_id: effect.id,
      effect_name: effect.name,
      title: snapCopy(t, lang, effect.id, "title", effect.title, effect.name),
      emoji: effect.emoji,
      age_restricted: effect.age_restricted,
      input: snapInput(effect),
    });
    SnapFlow.setVideo(null);
    SnapFlow.setPhoto(null);
    SnapFlow.setJobId(null);
  };

  /**
   * Ten FX is a real price. Finding out it is unaffordable AFTER picking a
   * photo and watching an upload spinner is the worst moment to learn it, so
   * the balance is checked before anything else happens.
   */
  const canAfford = async (effect: SnapEffect): Promise<boolean> => {
    try {
      const balance = await SubAPI.fxBalance();
      if (balance.fx_credits >= effect.fx_cost) return true;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.error(
        t("snap_not_enough_fx")
          .replace("{fx}", String(effect.fx_cost))
          .replace("{have}", String(balance.fx_credits)),
      );
      router.push({ pathname: "/paywall", params: { reason: "snap" } });
      return false;
    } catch {
      // Offline or a hiccup: let the server be the judge (it answers 402).
      return true;
    }
  };

  const start = async (effect: SnapEffect) => {
    if (!(await canAfford(effect))) return;

    remember(effect);

    if (snapInput(effect) === "photo") {
      setSheetFor(effect);
      return;
    }

    router.push("/create/snap-record");
  };

  const choose = (effect: SnapEffect) => {
    if (effect.coming_soon) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.show(t("snap_coming_soon_toast"));
      return;
    }

    Haptics.selectionAsync().catch(() => {});

    // Realistic-injury looks ask once before they are used.
    if (effect.age_restricted) {
      Alert.alert(
        t("snap_age_gate_title"),
        t("snap_age_gate_body"),
        [
          { text: t("paywall_later"), style: "cancel" },
          { text: t("snap_age_gate_confirm"), onPress: () => { start(effect); } },
        ],
      );
      return;
    }

    start(effect);
  };

  const pickPhoto = async (kind: "camera" | "gallery") => {
    if (picking) return;
    setPicking(true);

    try {
      const pick = kind === "camera" ? await takePhoto() : await pickFromGallery();
      if (!pick) return;

      SnapFlow.setPhoto({ base64: pick.base64, mime: pick.mime, uri: pick.uri });
      setSheetFor(null);
      router.push("/create/snap-processing");
    } finally {
      setPicking(false);
    }
  };

  const floatUp = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const floatDown = float.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient
        colors={colors.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: colors.violet, top: -160, left: -140 }]} />
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: colors.accent, top: -120, right: -160 }]} />

      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <Pressable
          testID="snap-effect-back"
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* The hook. */}
          <Animated.View style={[styles.kicker, { borderColor: colors.accent, opacity: pulseOpacity }]}>
            <Ionicons name="sparkles" size={12} color={colors.accent} />
            <Text style={[styles.kickerText, { color: colors.accent }]}>{t("snap_hook_kicker")}</Text>
          </Animated.View>

          <HookTitle
            size={28}
            color={colors.onSurface}
            accent={colors.brand}
            style={{ marginTop: Spacing.md }}
          />
          <Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>{t("snap_pick_sub")}</Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl3 }} color={colors.brand} />
          ) : (
            <>
              {recordEffects.length > 0 && (
                <>
                  <SectionTitle
                    icon="videocam"
                    title={t("snap_section_record")}
                    sub={t("snap_section_record_sub")}
                  />

                  <View style={{ gap: Spacing.md }}>
                    {recordEffects.map((effect) => (
                      <Pressable
                        key={effect.id}
                        testID={`snap-effect-${effect.id}`}
                        onPress={() => choose(effect)}
                        style={({ pressed }) => [
                          effect.coming_soon && styles.soon,
                          pressed && !effect.coming_soon && { transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <LinearGradient
                          colors={snapGradientFor(effect.id)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.card, glow(snapGradientFor(effect.id)[1], "sm")]}
                        >
                          <View style={styles.cardEmojiWrap}>
                            <Animated.Text style={[styles.cardEmoji, { transform: [{ translateY: floatUp }] }]}>
                              {effect.emoji}
                            </Animated.Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardName}>{snapCopy(t, lang, effect.id, "title", effect.title, effect.name)}</Text>
                            <Text style={styles.cardTag} numberOfLines={2}>
                              {snapCopy(t, lang, effect.id, "tagline", effect.tagline)}
                            </Text>
                            <Text style={styles.cardCost}>
                              {effect.coming_soon ? t("snap_coming_soon") : `${effect.fx_cost} FX`}
                            </Text>
                          </View>

                          <View style={styles.recDot}>
                            <Ionicons name="videocam" size={18} color="#fff" />
                          </View>
                        </LinearGradient>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {photoEffects.length > 0 && (
                <>
                  <SectionTitle
                    icon="image"
                    title={t("snap_section_photo")}
                    sub={t("snap_section_photo_sub")}
                  />

                  <View style={styles.grid}>
                    {photoEffects.map((effect, index) => (
                      <Pressable
                        key={effect.id}
                        testID={`snap-effect-${effect.id}`}
                        onPress={() => choose(effect)}
                        style={({ pressed }) => [
                          styles.tileWrap,
                          effect.coming_soon && styles.soon,
                          pressed && !effect.coming_soon && { transform: [{ scale: 0.97 }] },
                        ]}
                      >
                        <LinearGradient
                          colors={snapGradientFor(effect.id)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.tile, glow(snapGradientFor(effect.id)[1], "sm")]}
                        >
                          <LinearGradient
                            colors={["transparent", "rgba(5,4,12,0.55)"]}
                            locations={[0.35, 1]}
                            style={StyleSheet.absoluteFill}
                          />

                          {effect.coming_soon ? (
                            <View style={[styles.badge, styles.badgeSoon]}>
                              <Ionicons name="lock-closed" size={10} color="#fff" />
                              <Text style={styles.badgeText}>{t("snap_coming_soon")}</Text>
                            </View>
                          ) : effect.badge ? (
                            <View style={[styles.badge, effect.badge === "hit" ? styles.badgeHit : styles.badgeNew]}>
                              <Text style={styles.badgeText}>
                                {effect.badge === "hit" ? `🔥 ${t("snap_badge_hit")}` : t("snap_badge_new")}
                              </Text>
                            </View>
                          ) : null}

                          <Animated.Text
                            style={[
                              styles.tileEmoji,
                              { transform: [{ translateY: index % 2 === 0 ? floatUp : floatDown }] },
                            ]}
                          >
                            {effect.emoji}
                          </Animated.Text>

                          <View>
                            <Text style={styles.tileName} numberOfLines={2}>
                              {snapCopy(t, lang, effect.id, "title", effect.title, effect.name)}
                            </Text>
                            <Text style={styles.tileTag} numberOfLines={2}>
                              {snapCopy(t, lang, effect.id, "tagline", effect.tagline)}
                            </Text>
                            <View style={styles.tileMeta}>
                              <Ionicons name={effect.coming_soon ? "time" : "flash"} size={11} color="#fff" />
                              <Text style={styles.tileMetaText}>
                                {effect.coming_soon
                                  ? t("snap_coming_soon")
                                  : `${effect.fx_cost} FX · ${t("snap_five_sec")}`}
                              </Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {hiddenCount > 0 && (
            <View style={[styles.note, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="lock-closed" size={16} color={colors.onSurfaceTertiary} />
              <Text style={[styles.noteText, { color: colors.onSurfaceTertiary }]}>
                {t("age_rule_restricted")}
              </Text>
            </View>
          )}

          <View style={[styles.note, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
            <Text style={[styles.noteText, { color: colors.onSurfaceTertiary }]}>
              {t("snap_cost_note").replace("{fx}", String(cost))}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Photo source sheet */}
      <Modal
        visible={!!sheetFor}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetFor(null)}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => !picking && setSheetFor(null)} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />

          {sheetFor && (
            <LinearGradient
              colors={snapGradientFor(sheetFor.id)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetHero}
            >
              <Text style={styles.sheetEmoji}>{sheetFor.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName}>{snapCopy(t, lang, sheetFor.id, "title", sheetFor.title, sheetFor.name)}</Text>
                <Text style={styles.sheetTag} numberOfLines={2}>{snapCopy(t, lang, sheetFor.id, "tagline", sheetFor.tagline)}</Text>
              </View>
            </LinearGradient>
          )}

          <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>{t("snap_source_title")}</Text>
          <Text style={[styles.sheetTip, { color: colors.onSurfaceTertiary }]}>{t("snap_source_tip")}</Text>

          <View style={styles.sheetActions}>
            <Pressable testID="snap-source-camera" onPress={() => pickPhoto("camera")} disabled={picking} style={{ flex: 1 }}>
              <LinearGradient
                colors={colors.brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.sheetButton, glow(colors.glowBrand, "sm")]}
              >
                <Ionicons name="camera" size={22} color={colors.onBrand} />
                <Text style={[styles.sheetButtonText, { color: colors.onBrand }]}>{t("snap_source_camera")}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              testID="snap-source-gallery"
              onPress={() => pickPhoto("gallery")}
              disabled={picking}
              style={[styles.sheetButton, { flex: 1, backgroundColor: colors.surfaceTertiary, borderColor: colors.border, borderWidth: 1 }]}
            >
              {picking
                ? <ActivityIndicator color={colors.onSurface} />
                : <Ionicons name="images" size={22} color={colors.onSurface} />}
              <Text style={[styles.sheetButtonText, { color: colors.onSurface }]}>{t("snap_source_gallery")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({ icon, title, sub }: { icon: any; title: string; sub: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Ionicons name={icon} size={16} color={colors.brand} />
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>
      </View>
      <Text style={[styles.sectionSub, { color: colors.onSurfaceTertiary }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: "absolute", width: 340, height: 340, borderRadius: 170, opacity: 0.16 },

  back: {
    alignSelf: "flex-start",
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xl,
  },

  kicker: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  kickerText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, letterSpacing: Tracking.kicker },

  h1: {
    fontSize: FontSize.xl3,
    lineHeight: 36,
    fontWeight: FontWeight.heavy,
    marginTop: Spacing.md,
    letterSpacing: Tracking.display,
  },
  sub: { fontSize: FontSize.md, marginTop: 8, lineHeight: 21 },

  section: { marginTop: Spacing.xl2, marginBottom: Spacing.md },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, letterSpacing: Tracking.title },
  sectionSub: { fontSize: FontSize.sm, marginTop: 4 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: Spacing.md },
  tileWrap: { width: "48.3%" },
  tile: {
    minHeight: 204,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  tileEmoji: { fontSize: 42, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  tileName: {
    color: "#fff",
    fontSize: FontSize.md,
    lineHeight: 19,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
  },
  tileTag: { color: "rgba(255,255,255,0.9)", fontSize: FontSize.xs, lineHeight: 15, marginTop: 3 },
  tileMeta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 3,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  tileMetaText: { color: "#fff", fontSize: 10, fontWeight: FontWeight.bold },

  badge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeHit: { backgroundColor: "rgba(5,4,12,0.55)" },
  badgeSoon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(5,4,12,0.7)",
  },
  // Visible enough to tease, flat enough to read as "not yet".
  soon: { opacity: 0.5 },
  badgeNew: { backgroundColor: "rgba(255,255,255,0.28)" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: FontWeight.heavy, letterSpacing: 0.6 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  cardEmojiWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmoji: { fontSize: 30 },
  cardName: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.heavy, letterSpacing: Tracking.title },
  cardTag: { color: "rgba(255,255,255,0.9)", fontSize: FontSize.sm, marginTop: 2, lineHeight: 16 },
  cardCost: { color: "rgba(255,255,255,0.88)", fontSize: FontSize.xs, marginTop: 4, fontWeight: FontWeight.bold },
  recDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(5,4,12,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  note: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },

  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.lg },
  sheetHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  sheetEmoji: { fontSize: 38 },
  sheetName: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.heavy },
  sheetTag: { color: "rgba(255,255,255,0.92)", fontSize: FontSize.sm, marginTop: 2 },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, marginTop: Spacing.xl, letterSpacing: Tracking.title },
  sheetTip: { fontSize: FontSize.sm, marginTop: 6, lineHeight: 18 },
  sheetActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xl },
  sheetButton: {
    height: 96,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  sheetButtonText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
