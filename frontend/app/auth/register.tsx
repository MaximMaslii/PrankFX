import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { GradientButton } from "@/src/components/GradientButton";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function Register() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { registerWithEmail, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email || password.length < 6) {
      Toast.error(t("password_min_length"));
      return;
    }
    setSubmitting(true);
    try {
      await registerWithEmail(email.trim(), password, name.trim() || undefined);
      router.replace("/home");
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable testID="register-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>

        <Text style={[styles.title, { color: colors.onSurface }]}>{t("create_account")}</Text>

        <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="person" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="register-name-input"
            style={[styles.textInput, { color: colors.onSurface }]}
            placeholder={t("name")}
            placeholderTextColor={colors.onSurfaceTertiary}
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="mail" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="register-email-input"
            style={[styles.textInput, { color: colors.onSurface }]}
            placeholder={t("email")}
            placeholderTextColor={colors.onSurfaceTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="lock-closed" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="register-password-input"
            style={[styles.textInput, { color: colors.onSurface }]}
            placeholder={t("password")}
            placeholderTextColor={colors.onSurfaceTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <GradientButton testID="register-submit-button" label={t("sign_up")} onPress={submit} loading={submitting || loading} />

        <Pressable testID="register-goto-login" onPress={() => router.push("/auth/login")} style={styles.switch}>
          <Text style={[styles.switchText, { color: colors.onSurfaceTertiary }]}>{t("have_account")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  back: { alignSelf: "flex-start", padding: Spacing.sm },
  title: { fontSize: FontSize.xl2, fontWeight: FontWeight.bold, marginTop: Spacing.md, marginBottom: Spacing.md },
  input: {
    flexDirection: "row", alignItems: "center", gap: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.lg, height: 54,
  },
  textInput: { flex: 1, fontSize: FontSize.md, paddingVertical: 0 },
  switch: { alignItems: "center", padding: Spacing.md, marginTop: Spacing.md },
  switchText: { fontSize: FontSize.base },
});
