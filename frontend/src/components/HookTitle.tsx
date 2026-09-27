/**
 * "You've never tried anything like this" — the app's hook headline.
 *
 * Set in Unbounded Black (a wide, rounded display face) instead of the system
 * font, with the second half lit in neon and glowing. It re-renders in the
 * current language automatically, because both halves come from `t()`.
 */
import React from "react";
import { StyleSheet, Text, TextStyle } from "react-native";

import { useI18n } from "@/src/i18n/I18nProvider";
import { FontFamily } from "@/src/theme/tokens";

type Props = {
  size?: number;
  /** Colour of the first half. */
  color?: string;
  /** Colour of the glowing second half. */
  accent?: string;
  align?: TextStyle["textAlign"];
  style?: TextStyle;
};

export function HookTitle({
  size = 28,
  color = "#FFFFFF",
  accent = "#D8FF5C",
  align = "left",
  style,
}: Props) {
  const { t } = useI18n();

  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.base,
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.18),
          color,
          textAlign: align,
        },
        style,
      ]}
    >
      {t("snap_hook_lead")}{"\n"}
      <Text
        style={{
          color: accent,
          textShadowColor: accent,
          textShadowRadius: 14,
          textShadowOffset: { width: 0, height: 0 },
        }}
      >
        {t("snap_hook_accent")}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FontFamily.display,
    letterSpacing: -0.6,
    // Android adds font padding that, with a display face this tall, pushes
    // the second line visibly lower than the first.
    includeFontPadding: false,
  },
});
