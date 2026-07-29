import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  reason?: "credits" | "premium";
};

const PERKS = [
  { icon: "infinite", text: "Unlimited AI creations" },
  { icon: "sparkles", text: "All Face, Vehicle, House & Object FX" },
  { icon: "image", text: "HD export, no watermark" },
  { icon: "flash", text: "Priority AI processing" },
];

export function PaywallModal({ visible, onClose, onUpgrade, reason = "credits" }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.handleBar} />

          <LinearGradient
            colors={colors.premiumGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroBadge}>
              <Ionicons name="diamond" size={16} color="#fff" />
              <Text style={styles.heroBadgeText}>PREMIUM</Text>
            </View>
            <Text style={styles.heroTitle}>{t("paywall_title")}</Text>
            <Text style={styles.heroSub}>{t("paywall_sub")}</Text>
          </LinearGradient>

          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p.text} style={styles.perkRow}>
                <View style={[styles.perkIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name={p.icon as any} size={16} color={colors.brand} />
                </View>
                <Text style={[styles.perkText, { color: colors.onSurface }]}>{p.text}</Text>
              </View>
            ))}
          </View>

          <Pressable testID="paywall-upgrade" onPress={onUpgrade} style={{ marginBottom: Spacing.md }}>
            <LinearGradient
              colors={colors.brandGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{t("paywall_cta")}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>

          <Pressable testID="paywall-close" onPress={onClose} style={styles.later}>
            <Text style={[styles.laterText, { color: colors.onSurfaceTertiary }]}>{t("paywall_later")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl2,
    paddingTop: 8,
  },
  handleBar: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: "rgba(120,120,128,0.4)",
    alignSelf: "center", marginBottom: Spacing.md,
  },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, marginBottom: Spacing.xl },
  heroBadge: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: Spacing.md,
  },
  heroBadgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  heroTitle: { color: "#fff", fontSize: FontSize.xl2, fontWeight: FontWeight.heavy, letterSpacing: -0.3 },
  heroSub: { color: "rgba(255,255,255,0.92)", fontSize: FontSize.base, marginTop: Spacing.sm, lineHeight: 20 },
  perks: { marginBottom: Spacing.xl },
  perkRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  perkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  perkText: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16, borderRadius: Radius.pill,
    shadowColor: "#FF3B30", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  ctaText: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  later: { alignItems: "center", padding: Spacing.md },
  laterText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});
