import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, LogBox, StatusBar, View } from "react-native";
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
SplashScreen.preventAutoHideAsync().catch(() => {});

const ONBOARDED_KEY = "prankfx.onboarded";

/**
 * Routes reachable while signed in. Anything not listed here that a signed-in
 * user lands on gets redirected to /home.
 *
 * The previous gate used `!inTabs && !inCreate`, which quietly treated
 * `/collection` as an unknown route and bounced it straight back to Home — so
 * tapping a collection on the Home screen did nothing. Listing the routes
 * explicitly makes that class of bug impossible.
 */
const SIGNED_IN_ROUTES = ["(tabs)", "create", "collection"];

function RootGate() {
  const { user, bootLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { colors, mode } = useTheme();

  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  // Remembers the last route we sent the user to, so a redirect is never
  // issued twice in a row for the same destination (which caused flicker and
  // occasional "navigate before mount" warnings).
  const lastRedirect = useRef<string | null>(null);

  // Read the onboarding flag once, not on every segment change.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const value = await storage.getItem<boolean>(ONBOARDED_KEY, false);
      if (mounted) setOnboarded(!!value);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Re-read the flag when the user leaves onboarding.
  const root = segments[0];

  useEffect(() => {
    if (root !== "onboarding" && onboarded === false) {
      storage.getItem<boolean>(ONBOARDED_KEY, false).then((value) => {
        if (value) setOnboarded(true);
      });
    }
  }, [root, onboarded]);

  useEffect(() => {
    // Wait until the router is actually mounted; navigating before that throws.
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
      if (!inOnboarding) go("/onboarding");
      return;
    }

    if (!user) {
      if (!inAuth) go("/auth/login");
      return;
    }

    // Signed in: only redirect away from auth/onboarding or an unknown route.
    if (inAuth || inOnboarding || !inSignedInArea) {
      go("/home");
      return;
    }

    // We are somewhere valid — allow the next redirect to fire freely.
    lastRedirect.current = null;
  }, [user, bootLoading, onboarded, root, router, navigationState?.key]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: "fade",
        }}
      />

      {/* Cover the app while the stored session is being validated, so the
          login screen never flashes for an already signed-in user. */}
      {bootLoading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      )}

      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging the app.
  if (!loaded && !error) return null;

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
