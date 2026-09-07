import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { useGoogleAuth } from "@/src/auth/useGoogleAuth";
import { GradientButton } from "@/src/components/GradientButton";
import { Toast } from "@/src/components/Toast";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
} from "@/src/theme/tokens";

export default function Login() {
  const { colors } = useTheme();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    loginWithEmail,
    loginWithGoogle,
    loading,
  } = useAuth();

  const {
    signIn: googleSignIn,
    busy: googleBusy,
    ready: googleReady,
  } = useGoogleAuth();

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

    // The user backed out of the Google browser — say nothing, that is normal.
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
  // UI
  // --------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: colors.surface,
      }}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={[
          styles.wrap,
          {
            paddingTop:
              insets.top + 40,

            paddingBottom:
              insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >

        {/* LANGUAGE SWITCHER */}

        <View
          style={[
            styles.languageSwitcher,
            {
              backgroundColor:
                colors.surfaceSecondary,

              borderColor:
                colors.border,
            },
          ]}
        >
          {languages.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                setLang(item.id)
              }
              style={[
                styles.languageItem,

                lang === item.id && {
                  backgroundColor:
                    colors.brand,
                },
              ]}
            >
              <Text
                style={[
                  styles.languageText,

                  {
                    color:
                      lang === item.id
                        ? "#fff"
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
          <View
            style={[
              styles.logo,
              {
                backgroundColor:
                  colors.brand,
              },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={32}
              color="#fff"
            />
          </View>

          <Text
            style={[
              styles.brand,
              {
                color:
                  colors.onSurface,
              },
            ]}
          >
            PrankFX
          </Text>

          <Text
            style={[
              styles.tag,
              {
                color:
                  colors.onSurfaceTertiary,
              },
            ]}
          >
            {t("cinematic_ai_effects")}
          </Text>
        </View>

        {/* TITLE */}

        <Text
          style={[
            styles.title,
            {
              color:
                colors.onSurface,
            },
          ]}
        >
          {t("welcome_back")}
        </Text>

        {/* EMAIL */}

        <View
          style={[
            styles.input,
            {
              backgroundColor:
                colors.surfaceSecondary,

              borderColor:
                colors.border,
            },
          ]}
        >
          <Ionicons
            name="mail"
            size={18}
            color={
              colors.onSurfaceTertiary
            }
          />

          <TextInput
            testID="login-email-input"
            style={[
              styles.textInput,
              {
                color:
                  colors.onSurface,
              },
            ]}
            placeholder={t("email")}
            placeholderTextColor={
              colors.onSurfaceTertiary
            }
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* PASSWORD */}

        <View
          style={[
            styles.input,
            {
              backgroundColor:
                colors.surfaceSecondary,

              borderColor:
                colors.border,
            },
          ]}
        >
          <Ionicons
            name="lock-closed"
            size={18}
            color={
              colors.onSurfaceTertiary
            }
          />

          <TextInput
            testID="login-password-input"
            style={[
              styles.textInput,
              {
                color:
                  colors.onSurface,
              },
            ]}
            placeholder={t("password")}
            placeholderTextColor={
              colors.onSurfaceTertiary
            }
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* FORGOT PASSWORD */}

        <Pressable
          testID="login-forgot"
          onPress={() =>
            router.push("/auth/forgot")
          }
          style={styles.forgot}
        >
          <Text
            style={[
              styles.forgotText,
              {
                color:
                  colors.brand,
              },
            ]}
          >
            {t("forgot_password")}
          </Text>
        </Pressable>

        {/* EMAIL LOGIN BUTTON */}

        <GradientButton
          testID="login-submit-button"
          label={t("log_in")}
          onPress={submit}
          loading={
            submitting || loading
          }
        />

        {/* DIVIDER */}

        <View
          style={
            styles.dividerWrap
          }
        >
          <View
            style={[
              styles.dividerLine,
              {
                backgroundColor:
                  colors.border,
              },
            ]}
          />

          <Text
            style={[
              styles.dividerText,
              {
                color:
                  colors.onSurfaceTertiary,
              },
            ]}
          >
            {t("or")}
          </Text>

          <View
            style={[
              styles.dividerLine,
              {
                backgroundColor:
                  colors.border,
              },
            ]}
          />
        </View>

        {/* GOOGLE LOGIN BUTTON */}

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
              color={
                colors.onSurface
              }
            />
          }
        />

        {/* SIGN UP */}

        <Pressable
          testID="login-goto-signup"
          onPress={() =>
            router.push(
              "/auth/register"
            )
          }
          style={styles.switch}
        >
          <Text
            style={[
              styles.switchText,
              {
                color:
                  colors.onSurfaceTertiary,
              },
            ]}
          >
            {t("no_account")}
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  languageSwitcher: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 3,
  },

  languageItem: {
    minWidth: 38,
    height: 32,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal:
      Spacing.sm,
  },

  languageText: {
    fontSize: FontSize.sm,
    fontWeight:
      FontWeight.semibold,
  },

  wrap: {
    paddingHorizontal:
      Spacing.xl,
    gap: Spacing.md,
  },

  logoWrap: {
    alignItems: "center",
    marginBottom:
      Spacing.xl2,
  },

  logo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,

    shadowColor: "#FF3B30",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 6,
  },

  brand: {
    fontSize:
      FontSize.xl3,
    fontWeight:
      FontWeight.heavy,
    letterSpacing: -0.5,
  },

  tag: {
    fontSize:
      FontSize.base,
    marginTop: 4,
  },

  title: {
    fontSize:
      FontSize.xl2,
    fontWeight:
      FontWeight.bold,
    marginBottom:
      Spacing.md,
  },

  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,

    borderRadius:
      Radius.md,

    borderWidth: 1,

    paddingHorizontal:
      Spacing.lg,

    height: 54,
  },

  textInput: {
    flex: 1,
    fontSize:
      FontSize.md,
    paddingVertical: 0,
  },

  forgot: {
    alignSelf: "flex-end",
    padding:
      Spacing.xs,
    marginBottom:
      Spacing.md,
  },

  forgotText: {
    fontSize:
      FontSize.base,
    fontWeight:
      FontWeight.semibold,
  },

  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical:
      Spacing.md,
  },

  dividerLine: {
    flex: 1,
    height: 1,
  },

  dividerText: {
    fontSize:
      FontSize.sm,
    fontWeight:
      FontWeight.medium,
  },

  switch: {
    alignItems: "center",
    padding:
      Spacing.md,
    marginTop:
      Spacing.sm,
  },

  switchText: {
    fontSize:
      FontSize.base,
  },
});