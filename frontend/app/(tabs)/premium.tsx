import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { SubAPI } from "@/src/api/client";
import { GradientButton } from "@/src/components/GradientButton";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

const PRICES = {
  face_effects: { month: 4.99, year: 39.99 },
  ultimate: { month: 14.99, year: 119.99 },
};

const FACE_PERKS = [
  "unlimited_face_effects",
  "hd_export",
  "no_watermark",
  "priority_ai_processing",
  "unlimited_history",
] 

const ULT_PERKS = [
  "everything_face_premium",
  "vehicle_effects",
  "house_effects",
  "object_effects",
  "future_premium_effects",
  "unlimited_ai_generations",
  "priority_servers",
] 

export default function PremiumScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();

  const [interval, setInterval] = useState<"month" | "year">("month");
  const [tier, setTier] = useState<"face_effects" | "ultimate">("ultimate");
  const [loading, setLoading] = useState(false);

  const subscribe = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLoading(true);
    try {
      await SubAPI.mockActivate(tier, interval);
      await refresh();
      Toast.success(t("premium_activated"));
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  const restore = async () => {
    setLoading(true);
    try {
      const r = await SubAPI.restore();
      await refresh();
      Toast.success(r.is_premium ? t("purchases_restored") : t("no_active_subscription"));
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    setLoading(true);
    try {
      await SubAPI.cancel();
      await refresh();
      Toast.success(t("subscription_canceled"));
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  const priceLabel = (v: number) => `$${v.toFixed(2)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 160 + insets.bottom, paddingHorizontal: Spacing.xl }}>
        <View style={{ alignItems: "center", marginBottom: Spacing.xl }}>
          <View style={[styles.crown, { backgroundColor: colors.brand }]}>
            <Ionicons name="diamond" size={26} color="#fff" />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface }]}>{t("premium")}</Text>
          <Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>{t("premium_subtitle")}</Text>
        </View>

        {/* Interval toggle */}
        <View style={[styles.segment, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {(["month", "year"] as const).map((k) => {
            const active = interval === k;
            return (
              <Pressable
                key={k}
                testID={`interval-${k}`}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setInterval(k); }}
                style={[styles.segItem, active && { backgroundColor: colors.brand }]}
              >
                <Text style={[styles.segText, { color: active ? "#fff" : colors.onSurface }]}>
                  {k === "month" ? t("monthly") : t("yearly")}
                </Text>
                {k === "year" && (
                  <Text style={styles.saveTagText}>{t("save_percent")}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Face plan */}
        <PlanCard
          testID="plan-face"
          title={t("face_plan")}
          price={priceLabel(PRICES.face_effects[interval])}
          suffix={interval === "month" ? t("per_month") : t("per_year")}
          perks={FACE_PERKS}
          active={tier === "face_effects"}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setTier("face_effects"); }}
          highlight={false}
        />

        {/* Ultimate plan */}
        <PlanCard
          testID="plan-ultimate"
          title={t("ultimate_plan")}
          price={priceLabel(PRICES.ultimate[interval])}
          suffix={interval === "month" ? t("per_month") : t("per_year")}
          perks={ULT_PERKS}
          active={tier === "ultimate"}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setTier("ultimate"); }}
          highlight
          badge={t("most_popular")}
        />

        {user?.is_premium && (
          <View style={[styles.activeBox, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.onSurface, fontWeight: FontWeight.semibold, flex: 1 }}>
              {t("active_plan")}: {user.premium_tier?.replace("_", " ")}
            </Text>
            <Pressable onPress={cancel}>
              <Text style={{ color: colors.error, fontWeight: FontWeight.semibold }}>{t("cancel")}</Text>
            </Pressable>
          </View>
        )}

        <Pressable testID="restore-purchases" onPress={restore} style={styles.restore}>
          <Text style={{ color: colors.onSurfaceTertiary, fontWeight: FontWeight.semibold }}>{t("restore_purchases")}</Text>
        </Pressable>

        <Text style={[styles.disclaimer, { color: colors.onSurfaceTertiary }]}>
          {t("demo_subscription")}
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 80, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <GradientButton
          testID="subscribe-cta"
          label={`${t("subscribe")} • ${priceLabel(PRICES[tier][interval])}${interval === "month" ? t("per_month") : t("per_year")}`}
          onPress={subscribe}
          loading={loading}
        />
      </View>
    </View>
  );
}

function PlanCard({ title, price, suffix, perks, active, onPress, highlight, badge, testID }:
  { title: string; price: string; suffix: string; perks: string[]; active: boolean; onPress: () => void; highlight?: boolean; badge?: string; testID?: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={{ marginBottom: Spacing.md }}>
      <LinearGradient
        colors={active
          ? highlight ? colors.premiumGradient : colors.brandGradient
          : [colors.surfaceSecondary, colors.surfaceSecondary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.plan, { borderColor: active ? "transparent" : colors.border }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md }}>
          <Text style={[styles.planTitle, { color: active ? "#fff" : colors.onSurface }]}>{title}</Text>
          {badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: Spacing.md }}>
          <Text style={[styles.price, { color: active ? "#fff" : colors.onSurface }]}>{price}</Text>
          <Text style={[styles.suffix, { color: active ? "rgba(255,255,255,0.85)" : colors.onSurfaceTertiary }]}>{suffix}</Text>
        </View>
        {perks.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Ionicons name="checkmark-circle" size={16} color={active ? "#fff" : colors.brand} />
            <Text style={[styles.perk, { color: active ? "#fff" : colors.onSurface }]}>{t(p as any)}</Text>
          </View>
        ))}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crown: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  h1: { fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, letterSpacing: -0.5 },
  sub: { fontSize: FontSize.base, marginTop: 4 },
  segment: { flexDirection: "row", padding: 4, borderRadius: Radius.pill, borderWidth: 1, marginBottom: Spacing.xl },
  segItem: { flex: 1, paddingVertical: 12, borderRadius: Radius.pill, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  segText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  saveTag: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saveTagText: { color: "#fff", fontSize: 10, fontWeight: FontWeight.bold },
  plan: { borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1 },
  planTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  badge: { backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.4 },
  price: { fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, letterSpacing: -0.5 },
  suffix: { fontSize: FontSize.base, marginLeft: 4, fontWeight: FontWeight.medium },
  perk: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  restore: { alignItems: "center", padding: Spacing.md, marginTop: Spacing.md },
  disclaimer: { fontSize: FontSize.xs, textAlign: "center", marginTop: 8, paddingHorizontal: 30 },
  activeBox: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.md },
  stickyCta: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: Spacing.xl, borderTopWidth: StyleSheet.hairlineWidth,
  },
});
