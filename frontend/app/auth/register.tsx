import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { useGoogleAuth } from "@/src/auth/useGoogleAuth";
import { useAppleAuth } from "@/src/auth/useAppleAuth";
import { AppleSignInButton } from "@/src/components/AppleSignInButton";
import { GradientButton } from "@/src/components/GradientButton";
import { Field } from "@/src/components/Field";
import { Toast } from "@/src/components/Toast";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Tracking,
} from "@/src/theme/tokens";

export default function Register() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();

  // Where to go once the account exists. Someone who came here from the
  // paywall was three taps into buying something — dropping them on the home
  // screen makes them find their way back and start again.
  const params = useLocalSearchParams<{ intent?: string }>();

  const afterSignUp = () => {
    if (params.intent === "subscribe") {
      router.replace({ pathname: "/paywall", params: { reason: "premium" } });
      return;
    }

    if (params.intent === "purchase") {
      router.replace("/premium");
      return;
    }

    router.replace("/home");
  };
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { registerWithEmail, loginWithGoogle, loginWithApple, loading, isGuest } =
    useAuth();

  // What a guest actually gains by signing up. Worth saying out loud: from
  // their side the app already works, so "create an account" with no reason
  // attached reads as a demand rather than an offer.
  const guestCopy = {
    en: {
      keeps: "Your FX, your history and anything you buy stay with this account — on this phone and the next one.",
      skip: "Keep using PrankFX without an account",
    },
    ru: {
      keeps: "Ваши FX, история и покупки останутся за этим аккаунтом — и на этом телефоне, и на следующем.",
      skip: "Продолжить без аккаунта",
    },
    de: {
      keeps: "Deine FX, deine Historie und deine Käufe bleiben bei diesem Konto — auf diesem Handy und dem nächsten.",
      skip: "Ohne Konto weitermachen",
    },
  }[lang];

  const {
    signIn: googleSignIn,
    busy: googleBusy,
    ready: googleReady,
  } = useGoogleAuth();

  const {
    signIn: appleSignIn,
    available: appleAvailable,
    busy: appleBusy,
  } = useAppleAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline rather than a toast: the rule belongs next to the field it governs.
  const passwordError =
    password.length > 0 && password.length < 6
      ? t("password_min_length")
      : undefined;

  const submit = async () => {
    if (!email || password.length < 6) {
      Toast.error(t("password_min_length"));
      return;
    }

    setSubmitting(true);

    try {
      await registerWithEmail(email.trim(), password, name.trim() || undefined);
      afterSignUp();
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  // Signing up with Google is the same call as signing in: the backend creates
  // the account on first sight of a verified Google email.
  const googleRegister = async () => {
    if (googleBusy || submitting) return;

    if (!googleReady) {
      Toast.error(t("google_not_ready"));
      return;
    }

    const outcome = await googleSignIn();

    if (outcome.status === "cancelled") return;

    if (outcome.status === "error") {
      Toast.error(outcome.message);
      return;
    }

    try {
      await loginWithGoogle(outcome.idToken);
      afterSignUp();
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    }
  };

  const appleRegister = async () => {
    if (appleBusy || googleBusy || submitting) return;

    const outcome = await appleSignIn();

    if (outcome.status === "cancelled") return;

    if (outcome.status === "error") {
      Toast.error(
        outcome.code === "not_configured" ? t("apple_not_ready") : outcome.message,
      );
      return;
    }

    try {
      await loginWithApple(outcome.identityToken, outcome.fullName);
      afterSignUp();
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
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
          { backgroundColor: colors.accent, top: -140, right: -130 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.wash,
          { backgroundColor: colors.violet, top: 120, left: -150 },
        ]}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.wrap,
            {
              paddingTop: insets.top + Spacing.md,
              paddingBottom: insets.bottom + Spacing.xl2,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            testID="register-back"
            onPress={() => router.back()}
            style={[
              styles.back,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>

          <View style={styles.logoWrap}>
            <Image
              testID="register-logo"
              source={require("../../assets/images/prankfx-logo.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="PrankFX"
            />
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.onSurface }]}>
              {t("create_account")}
            </Text>

            <Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>
              {t("cinematic_ai_effects")}
            </Text>

            <Field
              testID="register-name-input"
              label={t("name")}
              icon="person"
              value={name}
              onChangeText={setName}
            />

            <Field
              testID="register-email-input"
              label={t("email")}
              icon="mail"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <Field
              testID="register-password-input"
              label={t("password")}
              icon="lock-closed"
              placeholder="••••••••"
              secure
              value={password}
              onChangeText={setPassword}
              error={passwordError}
              hint={t("password_min_length")}
            />

            <GradientButton
              testID="register-submit-button"
              label={t("sign_up")}
              onPress={submit}
              loading={submitting || (loading && !googleBusy)}
              disabled={googleBusy}
            />

            <View style={styles.dividerWrap}>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />

              <Text
                style={[
                  styles.dividerText,
                  { color: colors.onSurfaceTertiary },
                ]}
              >
                {t("or")}
              </Text>

              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
            </View>

            <GradientButton
              testID="register-google-button"
              variant="secondary"
              label={t("continue_google")}
              onPress={googleRegister}
              loading={googleBusy}
              disabled={submitting}
              icon={
                <Ionicons
                  name="logo-google"
                  size={18}
                  color={colors.onSurface}
                />
              }
            />

            {appleAvailable && (
              <AppleSignInButton
                kind="sign-up"
                busy={appleBusy}
                onPress={appleRegister}
              />
            )}
          </View>

          {isGuest && (
            <Text
              style={[
                styles.switchText,
                {
                  color: colors.onSurfaceTertiary,
                  textAlign: "center",
                  marginTop: Spacing.lg,
                  lineHeight: 18,
                },
              ]}
            >
              {guestCopy.keeps}
            </Text>
          )}

          <Pressable
            testID="register-goto-login"
            onPress={() => router.push("/auth/login")}
            style={styles.switch}
          >
            <Text
              style={[styles.switchText, { color: colors.onSurfaceTertiary }]}
            >
              {t("have_account")}
            </Text>
          </Pressable>

          {isGuest && (
            <Pressable
              testID="auth-skip"
              onPress={() => router.replace("/home")}
              style={styles.switch}
            >
              <Text
                style={[styles.switchText, { color: colors.onSurfaceTertiary }]}
              >
                {guestCopy.skip}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.15,
  },

  wrap: {
    paddingHorizontal: Spacing.xl,
  },

  back: {
    alignSelf: "flex-start",
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  logoWrap: {
    alignItems: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },

  logo: {
    width: 124,
    height: 124,
  },

  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
  },

  title: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
  },

  sub: {
    fontSize: FontSize.base,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },

  appleButton: {
    width: "100%",
    height: 56,
    marginTop: Spacing.md,
  },

  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },

  dividerLine: {
    flex: 1,
    height: 1,
  },

  dividerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: Tracking.kicker,
  },

  switch: {
    alignItems: "center",
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },

  switchText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
});
