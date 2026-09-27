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
import { useRouter } from "expo-router";
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

export default function Login() {
  const { colors } = useTheme();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    user,
    loginWithEmail,
    loginWithGoogle,
    loginWithApple,
    continueAsGuest,
    loading,
    isGuest,
  } = useAuth();

  // The escape hatch.
  //
  // The app normally creates a guest session by itself at launch, and this
  // screen is only reached when that failed — almost always because the
  // backend was unreachable. Landing someone on a sign-in form they also
  // cannot submit is a dead end, so the retry lives here, and it reports the
  // real reason instead of swallowing it.
  const [guestBusy, setGuestBusy] = useState(false);

  const continueGuest = async () => {
    if (guestBusy) return;

    setGuestBusy(true);

    try {
      await continueAsGuest();
      router.replace("/home");
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setGuestBusy(false);
    }
  };

  // A guest arrived here from Settings or the paywall — they already have a
  // working session, so this screen must not be a dead end.
  const skipLabel = {
    en: "Keep using PrankFX without an account",
    ru: "Продолжить без аккаунта",
    de: "Ohne Konto weitermachen",
  }[lang];


  const {
    signIn: googleSignIn,
    busy: googleBusy,
    ready: googleReady,
  } = useGoogleAuth();

  // Apple's own button, only where Apple allows it to exist.
  const {
    signIn: appleSignIn,
    available: appleAvailable,
    busy: appleBusy,
  } = useAppleAuth();

  const languages = [
    { id: "en" as const, label: "EN" },
    { id: "ru" as const, label: "RU" },
    { id: "de" as const, label: "DE" },
  ];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // --------------------------------------------------
  // EMAIL LOGIN
  // --------------------------------------------------

  const submit = async () => {
    if (!email || !password) {
      Toast.error(t("enter_email_password"));
      return;
    }

    setSubmitting(true);

    try {
      await loginWithEmail(email.trim(), password);

      router.replace("/home");
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------
  // GOOGLE LOGIN
  // --------------------------------------------------

  const googleLogin = async () => {
    if (googleBusy || submitting) return;

    if (!googleReady) {
      Toast.error(t("google_not_ready"));
      return;
    }

    const outcome = await googleSignIn();

    // The user backed out of the Google dialog — say nothing, that is normal.
    if (outcome.status === "cancelled") return;

    if (outcome.status === "error") {
      // Show the real reason instead of failing silently.
      Toast.error(outcome.message);
      return;
    }

    try {
      await loginWithGoogle(outcome.idToken);
      // Navigation is handled by the gate in app/_layout.tsx once `user` is set.
      router.replace("/home");
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    }
  };

  // --------------------------------------------------
  // APPLE LOGIN
  // --------------------------------------------------

  const appleLogin = async () => {
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
      router.replace("/home");
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient
        colors={colors.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Two colour washes behind the form — the sign-in screen is the first
          thing anyone sees, and a flat background here is a wasted first
          impression. */}
      <View
        pointerEvents="none"
        style={[
          styles.wash,
          { backgroundColor: colors.violet, top: -150, left: -120 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.wash,
          { backgroundColor: colors.accent, top: 60, right: -160 },
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
              paddingTop: insets.top + Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl2,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* LANGUAGE SWITCHER */}

          <View
            style={[
              styles.languageSwitcher,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            {languages.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setLang(item.id)}
                style={[
                  styles.languageItem,
                  lang === item.id && {
                    backgroundColor: colors.surfaceTertiary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.languageText,
                    {
                      color:
                        lang === item.id
                          ? colors.brand
                          : colors.onSurfaceTertiary,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* LOGO */}

          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/images/prankfx-logo.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="PrankFX"
            />

            <Text style={[styles.brand, { color: colors.onSurface }]}>
              PRANK<Text style={{ color: colors.brand }}>FX</Text>
            </Text>

            <Text style={[styles.tag, { color: colors.onSurfaceTertiary }]}>
              {t("cinematic_ai_effects")}
            </Text>
          </View>

          {/* CARD */}

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
              {t("welcome_back")}
            </Text>

            <Field
              testID="login-email-input"
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
              testID="login-password-input"
              label={t("password")}
              icon="lock-closed"
              placeholder="••••••••"
              secure
              value={password}
              onChangeText={setPassword}
            />

            <Pressable
              testID="login-forgot"
              onPress={() => router.push("/auth/forgot")}
              style={styles.forgot}
              hitSlop={8}
            >
              <Text style={[styles.forgotText, { color: colors.brand }]}>
                {t("forgot_password")}
              </Text>
            </Pressable>

            <GradientButton
              testID="login-submit-button"
              label={t("log_in")}
              onPress={submit}
              loading={submitting || loading}
            />

            {/* DIVIDER */}

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
              testID="login-google-button"
              variant="secondary"
              label={t("continue_google")}
              onPress={googleLogin}
              loading={googleBusy || (loading && !submitting)}
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
                kind="sign-in"
                busy={appleBusy}
                onPress={appleLogin}
              />
            )}
          </View>

          {/* SIGN UP */}

          <Pressable
            testID="login-goto-signup"
            onPress={() => router.push("/auth/register")}
            style={styles.switch}
          >
            <Text
              style={[styles.switchText, { color: colors.onSurfaceTertiary }]}
            >
              {t("no_account")}
            </Text>
          </Pressable>

          {!user && (
            <Pressable
              testID="auth-continue-guest"
              onPress={continueGuest}
              disabled={guestBusy}
              style={[styles.switch, { opacity: guestBusy ? 0.5 : 1 }]}
            >
              <Text
                style={[styles.switchText, { color: colors.brand }]}
              >
                {t("continue_as_guest")}
              </Text>
            </Pressable>
          )}

          {isGuest && (
            <Pressable
              testID="auth-skip"
              onPress={() => router.replace("/home")}
              style={styles.switch}
            >
              <Text
                style={[styles.switchText, { color: colors.onSurfaceTertiary }]}
              >
                {skipLabel}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

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

  languageSwitcher: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    padding: 3,
  },

  languageItem: {
    minWidth: 40,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
  },

  languageText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
  },

  logoWrap: {
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl2,
  },

  logo: {
    width: 116,
    height: 116,
  },

  brand: {
    fontSize: FontSize.xl3,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.display,
    marginTop: Spacing.sm,
  },

  tag: {
    fontSize: FontSize.base,
    marginTop: 4,
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
    marginBottom: Spacing.lg,
  },

  forgot: {
    alignSelf: "flex-end",
    paddingVertical: Spacing.xs,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },

  forgotText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
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
