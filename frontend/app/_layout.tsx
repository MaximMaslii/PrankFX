import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar, View } from "react-native";
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
SplashScreen.preventAutoHideAsync();

const ONBOARDED_KEY = "prankfx.onboarded";

function RootGate() {
  const { user, bootLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors, mode } = useTheme();

  useEffect(() => {
    if (bootLoading) return;
    (async () => {
      const onboarded = await storage.getItem<boolean>(ONBOARDED_KEY, false);
      const inAuth = segments[0] === "auth";
      const inOnboarding = segments[0] === "onboarding";
      const inTabs = segments[0] === "(tabs)";

      if (!onboarded && !inOnboarding) {
        router.replace("/onboarding");
        return;
      }
      if (onboarded && !user && !inAuth) {
        router.replace("/auth/login");
        return;
      }
      if (onboarded && user && (inAuth || inOnboarding || !inTabs && segments.length === 0)) {
        router.replace("/(tabs)/home");
      }
    })();
  }, [user, bootLoading, segments, router]);

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
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
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
