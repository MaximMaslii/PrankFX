import React, { useEffect, useRef, useState } from "react";
import {
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
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { getAgeAnswer, setAgeAnswer } from "@/src/utils/ageGate";
import { GradientButton } from "@/src/components/GradientButton";
import {
  FontSize,
  FontWeight,
  Motion,
  Radius,
  Spacing,
  Tracking,
  glow,
} from "@/src/theme/tokens";

type Rule = {
  icon: keyof typeof Ionicons.glyphMap;
  key: "age_rule_fake" | "age_rule_consent" | "age_rule_prank" | "age_rule_restricted";
};

const RULES: Rule[] = [
  { icon: "color-wand", key: "age_rule_fake" },
  { icon: "people", key: "age_rule_consent" },
  { icon: "happy", key: "age_rule_prank" },
  { icon: "lock-closed", key: "age_rule_restricted" },
];

/**
 * Content notice shown once, on the first launch.
 *
 * It is deliberately not a wall: a hard 18+ gate on a joke app teaches people
 * to tap whichever button makes the dialog go away, and it would push the
 * store rating to adults-only for effects that are PG-13 in practice. What it
 * does instead is state plainly what the app fabricates and what is not okay
 * to do with it — and a "no" answer actually costs something: the effects
 * marked 18+ disappear from the pickers.
 */
export function AgeNotice() {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [visible, setVisible] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { asked } = await getAgeAnswer();

      if (mounted && !asked) {
        setVisible(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Motion.base,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: Motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, lift]);

  const answer = async (adult: boolean) => {
    Haptics.impactAsync(
      adult
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});

    await setAgeAnswer(adult);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Animated.View
          style={[
            styles.card,
            glow(colors.glowAccent, "lg"),
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
              opacity,
              transform: [{ translateY: lift }],
            },
          ]}
        >
          {/* Badge */}
          <LinearGradient
            colors={colors.premiumGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>18+</Text>
          </LinearGradient>

          <Text style={[styles.kicker, { color: colors.accent }]}>
            {t("age_kicker")}
          </Text>

          <Text style={[styles.title, { color: colors.onSurface }]}>
            {t("age_title")}
          </Text>

          <ScrollView
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={[styles.lead, { color: colors.onSurfaceTertiary }]}>
              {t("age_lead")}
            </Text>

            <View style={styles.rules}>
              {RULES.map((rule) => (
                <View key={rule.key} style={styles.rule}>
                  <View
                    style={[
                      styles.ruleIcon,
                      { backgroundColor: colors.surfaceTertiary },
                    ]}
                  >
                    <Ionicons
                      name={rule.icon}
                      size={15}
                      color={colors.brand}
                    />
                  </View>

                  <Text
                    style={[styles.ruleText, { color: colors.onSurfaceSecondary }]}
                  >
                    {t(rule.key)}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.question, { color: colors.onSurface }]}>
              {t("age_question")}
            </Text>
          </ScrollView>

          <GradientButton
            testID="age-notice-adult"
            label={t("age_yes")}
            onPress={() => answer(true)}
          />

          <Pressable
            testID="age-notice-minor"
            onPress={() => answer(false)}
            style={styles.minor}
            accessibilityRole="button"
          >
            <Text style={[styles.minorText, { color: colors.onSurfaceTertiary }]}>
              {t("age_no")}
            </Text>
          </Pressable>

          <Text style={[styles.fine, { color: colors.onSurfaceTertiary }]}>
            {t("age_fine_print")}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl2,
    paddingTop: Spacing.xl2 + 8,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginBottom: Spacing.lg,
  },
  badgeText: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.6,
  },
  kicker: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: Tracking.kicker,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
    marginBottom: Spacing.md,
  },
  lead: {
    fontSize: FontSize.base,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  rules: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  rule: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  ruleIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  ruleText: {
    flex: 1,
    fontSize: FontSize.base,
    lineHeight: 19,
  },
  question: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  minor: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  minorText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  fine: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
});
