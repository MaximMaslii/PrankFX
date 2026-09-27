/**
 * "Continue with Apple" — the same button on both platforms.
 *
 * iOS: Apple's own native button (required look for App Store review).
 * Android: a hand-drawn twin that follows Apple's style rules — black or
 * white, the Apple logo, the same wording — because the native one does not
 * exist there.
 */
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";

import { useI18n } from "@/src/i18n/I18nProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

type Props = {
  onPress: () => void;
  busy?: boolean;
  /** "sign-up" on the registration screen, "sign-in" everywhere else. */
  kind?: "sign-in" | "sign-up";
};

export function AppleSignInButton({ onPress, busy, kind = "sign-in" }: Props) {
  const { mode } = useTheme();
  const { t } = useI18n();

  // Dark app → white button, light app → black button (Apple's guidance).
  const white = mode === "dark";

  if (Platform.OS === "ios") {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          kind === "sign-up"
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={
          white
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={Radius.md}
        style={styles.button}
        onPress={onPress}
      />
    );
  }

  const fg = white ? "#000000" : "#FFFFFF";

  return (
    <Pressable
      testID="apple-sign-in-button"
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        styles.custom,
        { backgroundColor: white ? "#FFFFFF" : "#000000", opacity: pressed || busy ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-apple" size={20} color={fg} />
          <Text style={[styles.label, { color: fg }]}>{t("sign_in_apple")}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: "100%", height: 56, marginTop: Spacing.md },
  custom: { borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  label: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
});
