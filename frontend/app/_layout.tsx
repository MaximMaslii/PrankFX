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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { I18nProvider } from "@/src/i18n/I18nProvider";
import { AuthProvider, useAuth } from "@/src/auth/AuthProvider";
import { storage } from "@/src/utils/storage";
import { ToastHost } from "@/src/components/Toast";

// Silence dev logs for a cleaner preview.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync().catch(() => { });

const ONBOARDED_KEY = "prankfx.onboarded";

/**
 * Routes reachable while signed in. Anything not listed here that a signed-in
 * user lands on gets redirected to /home.
 */
const SIGNED_IN_ROUTES = ["(tabs)", "create", "collection"];

function RootGate() {
  const { user, bootLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { colors, mode } = useTheme();

  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  // Startup loading screen state.
  const [startupVisible, setStartupVisible] = useState(true);
  const startupProgress = useRef(new Animated.Value(0)).current;
  const startupOpacity = useRef(new Animated.Value(1)).current;

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

  // Startup loading animation.
  // The progress bar runs smoothly for 3 seconds.
  // The splash disappears only when the animation is complete
  // AND the application is ready.
  useEffect(() => {
    const MIN_DISPLAY_TIME = 5000;

    const progressAnimation = Animated.timing(startupProgress, {
      toValue: 1,
      duration: MIN_DISPLAY_TIME,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });

    progressAnimation.start(({ finished }) => {
      if (!finished) return;

      const appReady = !bootLoading && onboarded !== null;

      if (!appReady) {
        // Keep the screen visible at 100% until the app is actually ready.
        return;
      }

      Animated.timing(startupOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: fadeFinished }) => {
        if (fadeFinished) {
          setStartupVisible(false);
        }
      });
    });

    return () => {
      progressAnimation.stop();
    };
  }, [
    bootLoading,
    onboarded,
    startupOpacity,
    startupProgress,
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
      if (!inAuth) {
        go("/auth/login");
      }
      return;
    }

    // Signed in: only redirect away from auth/onboarding or an unknown route.
    if (inAuth || inOnboarding || !inSignedInArea) {
      go("/home");
      return;
    }

    // We are somewhere valid.
    lastRedirect.current = null;
  }, [
    user,
    bootLoading,
    onboarded,
    root,
    router,
    navigationState?.key,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar
        barStyle={mode === "dark" ? "light-content" : "dark-content"}
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

      {/* EliMax startup loading screen */}
      {startupVisible && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.startupOverlay,
            {
              opacity: startupOpacity,
            },
          ]}
        >
          <Image
            source={require("../assets/images/elimax-splash.png")}
            style={styles.startupLogo}
            resizeMode="contain"
          />

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: startupProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>

          <Text style={styles.loadingText}>Loading...</Text>
        </Animated.View>
      )}

      <ToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  startupOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },

  startupLogo: {
    width: "82%",
    maxWidth: 420,
    height: 280,
    marginBottom: 20,
  },

  progressTrack: {
    width: "62%",
    maxWidth: 320,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#1677FF",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    letterSpacing: 0.4,
  },
});

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging the app.
  if (!loaded && !error) {
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