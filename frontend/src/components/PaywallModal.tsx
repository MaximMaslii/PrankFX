import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { GradientButton } from "@/src/components/GradientButton";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Tracking,
} from "@/src/theme/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  reason?: "credits" | "premium";
};

/**
 * The perks were hard-coded English in a trilingual app — a German user hit
 * the paywall and got an English pitch. They read from the dictionary now.
 */
const PERKS = [
  { icon: "infinite", key: "unlimited_ai_generations" },
  { icon: "sparkles", key: "unlimited_face_effects" },
  { icon: "image", key: "hd_export" },
  { icon: "flash", key: "priority_ai_processing" },
] as const;

export function PaywallModal({
  visible,
  onClose,
  onUpgrade,
  reason = "credits",
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.handleBar,
              { backgroundColor: colors.borderStrong },
            ]}
          />

          <LinearGradient
            colors={colors.premiumGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroBadge}>
              <Ionicons name="diamond" size={14} color="#fff" />
              <Text style={styles.heroBadgeText}>PREMIUM</Text>
            </View>

            <Text style={styles.heroTitle}>{t("paywall_title")}</Text>
            <Text style={styles.heroSub}>{t("paywall_sub")}</Text>
          </LinearGradient>

          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p.key} style={styles.perkRow}>
                <View
                  style={[
                    styles.perkIcon,
                    { backgroundColor: colors.surfaceTertiary },
                  ]}
                >
                  <Ionicons
                    name={p.icon as any}
                    size={16}
                    color={colors.brand}
                  />
                </View>

                <Text style={[styles.perkText, { color: colors.onSurface }]}>
                  {t(p.key as any)}
                </Text>
              </View>
            ))}
          </View>

          <GradientButton
            testID="paywall-upgrade"
            label={t("paywall_cta")}
            onPress={onUpgrade}
            icon={
              <Ionicons name="flash" size={18} color={colors.onBrand} />
            }
          />

          <Pressable
            testID="paywall-close"
            onPress={onClose}
            style={styles.later}
          >
            <Text style={[styles.laterText, { color: colors.onSurfaceTertiary }]}>
              {t("paywall_later")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl2,
    paddingTop: 8,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  hero: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(5,4,12,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.md,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.kicker,
  },
  heroTitle: {
    color: "#fff",
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
  },
  heroSub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  perks: {
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  later: {
    alignItems: "center",
    padding: Spacing.lg,
  },
  laterText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});
