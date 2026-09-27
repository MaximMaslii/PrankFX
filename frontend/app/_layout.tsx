import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  LogBox,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useFonts } from "expo-font";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppGate } from "@/src/components/AppGate";
import { useOtaUpdates } from "@/src/utils/otaUpdates";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { I18nProvider } from "@/src/i18n/I18nProvider";
import { AuthProvider, useAuth } from "@/src/auth/AuthProvider";
import { storage } from "@/src/utils/storage";
import { ToastHost } from "@/src/components/Toast";
import { AgeNotice } from "@/src/components/AgeNotice";
import {
  FontSize,
  FontWeight,
  Radius,
  FontFamily,
  Spacing,
  Tracking,
} from "@/src/theme/tokens";

// Silence dev logs for a cleaner preview.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync().catch(() => { });

const ONBOARDED_KEY = "prankfx.onboarded";

/**
 * Routes reachable while signed in. Anything not listed here that a signed-in
 * user lands on gets redirected to /home.
 */
const SIGNED_IN_ROUTES = ["(tabs)", "create", "collection", "paywall"];

/**
 * How long the branded loading screen is shown at minimum.
 *
 * It used to be five seconds — on a warm start the app was ready in a few
 * hundred milliseconds and then sat there watching a progress bar crawl. A
 * splash exists to hide work, not to perform it; 1.4s is enough to read the
 * wordmark and not enough to feel held up.
 */
const MIN_SPLASH_MS = 1400;

function RootGate() {
  const { user, bootLoading, continueAsGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { colors, mode } = useTheme();

  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  // Guest sign-in: attempted once per launch. `settled` flips either way —
  // a failure must not leave the app stuck on the splash screen with no way
  // forward, it just means the login screen is shown instead.
  const guestAttempted = useRef(false);
  const [guestSettled, setGuestSettled] = useState(false);

  // Startup screen state.
  const [startupVisible, setStartupVisible] = useState(true);
  const [minElapsed, setMinElapsed] = useState(false);
  const startupProgress = useRef(new Animated.Value(0)).current;
  const startupOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;

  // Remembers the last route we sent the user to.
  const lastRedirect = useRef<string | null>(null);

  // Read the onboarding flag once.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const value = await storage.getItem<boolean>(ONBOARDED_KEY, false);

      if (mounted) {
        setOnboarded(!!value);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Entry animation + minimum display timer.
  //
  // The old version hid the splash from inside the animation's completion
  // callback, and bailed out of that callback when the app was not ready yet —
  // so if boot took longer than the animation, nothing ever hid the splash
  // again. Readiness and timing are now two independent flags, and the effect
  // below reacts to whichever finishes last.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(startupProgress, {
        toValue: 1,
        duration: MIN_SPLASH_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        speed: 6,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);

    return () => clearTimeout(timer);
  }, [startupProgress, logoScale]);

  // ---------------------------------------------------------------
  // No session -> become a guest.
  //
  // This is the change that removes the sign-up wall: the app used to send a
  // first-time user to a registration form before it had shown them anything
  // worth registering for. Now it quietly creates an account for them and
  // asks for an identity later, at the point where one is actually needed.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (bootLoading || user || guestAttempted.current) return;

    guestAttempted.current = true;

    continueAsGuest()
      .catch(() => {
        // Backend unreachable, or guest mode disabled server-side. The gate
        // below then falls back to the login screen, which is the honest
        // thing to show: there is no session and we could not make one.
      })
      .finally(() => setGuestSettled(true));
  }, [bootLoading, user, continueAsGuest]);

  useEffect(() => {
    // Hold the splash until we know who the user is — otherwise the login
    // screen flashes for a moment on every cold start before the guest
    // session lands.
    const sessionSettled = !!user || guestSettled;

    const appReady = !bootLoading && onboarded !== null && sessionSettled;

    if (!startupVisible || !minElapsed || !appReady) return;

    Animated.timing(startupOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setStartupVisible(false);
    });
  }, [
    bootLoading,
    onboarded,
    minElapsed,
    startupVisible,
    startupOpacity,
    user,
    guestSettled,
  ]);

  // Re-read the flag when the user leaves onboarding.
  const root = segments[0];

  useEffect(() => {
    if (root !== "onboarding" && onboarded === false) {
      storage.getItem<boolean>(ONBOARDED_KEY, false).then((value) => {
        if (value) {
          setOnboarded(true);
        }
      });
    }
  }, [root, onboarded]);

  useEffect(() => {
    // Wait until the router is actually mounted.
    if (!navigationState?.key) return;
    if (bootLoading) return;
    if (onboarded === null) return;

    const inAuth = root === "auth";
    const inOnboarding = root === "onboarding";
    const inSignedInArea = SIGNED_IN_ROUTES.includes(root as string);

    const go = (target: string) => {
      if (lastRedirect.current === target) return;

      lastRedirect.current = target;
      router.replace(target as any);
    };

    if (!onboarded) {
      if (!inOnboarding) {
        go("/onboarding");
      }
      return;
    }

    if (!user) {
      // Still creating the guest session — hold still rather than flashing
      // the login screen and then replacing it a moment later.
      if (!guestSettled) return;

      if (!inAuth) {
        go("/auth/login");
      }
      return;
    }

    // A guest is signed in, but the login screen is a legitimate destination
    // for them: it is where "create an account" leads. Everyone else gets
    // moved off it, including a guest the moment they finish signing up.
    const guestOnAuth = inAuth && !!user.is_guest;

    if (inOnboarding || (!inSignedInArea && !guestOnAuth)) {
      go("/home");
      return;
    }

    // We are somewhere valid.
    lastRedirect.current = null;
  }, [
    user,
    bootLoading,
    onboarded,
    guestSettled,
    root,
    router,
    navigationState?.key,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar
        barStyle={mode === "dark" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.surface,
          },
          animation: "fade",
        }}
      />

      {/* Branded startup screen */}
      {startupVisible && (
        <Animated.View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: startupOpacity, zIndex: 9999 },
          ]}
        >
          <LinearGradient
            colors={colors.bgGradient}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.startupOverlay}
          >
            {/* Two soft colour washes — the whole "carnival at night" idea in
                two views, and far cheaper than a background image. */}
            <View
              style={[
                styles.wash,
                {
                  backgroundColor: colors.violet,
                  top: -120,
                  left: -80,
                },
              ]}
            />
            <View
              style={[
                styles.wash,
                {
                  backgroundColor: colors.accent,
                  bottom: -140,
                  right: -100,
                },
              ]}
            />

            <Animated.View
              style={{
                alignItems: "center",
                transform: [{ scale: logoScale }],
              }}
            >
              <Image
                source={require("../assets/images/prankfx-logo.png")}
                style={styles.startupLogo}
                resizeMode="contain"
              />

              <Text style={[styles.wordmark, { color: colors.onSurface }]}>
                PRANK<Text style={{ color: colors.brand }}>FX</Text>
              </Text>
            </Animated.View>

            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.surfaceTertiary },
              ]}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.brand,
                    width: startupProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["8%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      <ToastHost />

      {/* First-launch content notice. Rendered last so it sits above all. */}
      <AgeNotice />

      {/* Server-controlled: maintenance screen / "please update" screen. */}
      <AppGate />
    </View>
  );
}

const styles = StyleSheet.create({
  startupOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  wash: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.18,
  },

  startupLogo: {
    width: 150,
    height: 150,
    marginBottom: Spacing.md,
  },

  wordmark: {
    fontSize: FontSize.xl3,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.display,
  },

  progressTrack: {
    position: "absolute",
    bottom: 96,
    width: "48%",
    maxWidth: 260,
    height: 4,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
});

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();

  // The display face for the hook headlines. Bundled, so it loads in a few
  // milliseconds; an error simply means the system font is used instead.
  const [displayLoaded, displayError] = useFonts({
    [FontFamily.display]: require("../assets/fonts/Unbounded-Black.ttf"),
  });

  // Over-the-air updates: downloads a newer JS bundle in the background and
  // applies it on the next launch. A no-op in development.
  useOtaUpdates();

  // An error counts as "done" for either font set — a missing font must
  // never keep the app on the splash screen.
  const loaded =
    (iconsLoaded || !!iconsError) && (displayLoaded || !!displayError);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <RootGate />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
