import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { AuthAPI } from "@/src/api/client";
import { GradientButton } from "@/src/components/GradientButton";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function Forgot() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await AuthAPI.forgot(email.trim());
      Toast.success(r.message);
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.wrap, { paddingTop: insets.top + 20 }]}>
        <Pressable testID="forgot-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>

        <Text style={[styles.title, { color: colors.onSurface }]}>{t("reset_password")}</Text>
        <Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>{t("reset_password_sub")}</Text>

        <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="mail" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="forgot-email-input"
            style={[styles.textInput, { color: colors.onSurface }]}
            placeholder={t("email")}
            placeholderTextColor={colors.onSurfaceTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <GradientButton testID="forgot-submit-button" label={t("reset_password")} onPress={submit} loading={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: Spacing.xl, gap: Spacing.md },
  back: { alignSelf: "flex-start", padding: Spacing.sm },
  title: { fontSize: FontSize.xl2, fontWeight: FontWeight.bold, marginTop: Spacing.md },
  sub: { fontSize: FontSize.base, lineHeight: 20, marginBottom: Spacing.md },
  input: {
    flexDirection: "row", alignItems: "center", gap: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.lg, height: 54,
  },
  textInput: { flex: 1, fontSize: FontSize.md, paddingVertical: 0 },
});
