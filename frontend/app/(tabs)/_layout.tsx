import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  shadow,
} from "@/src/theme/tokens";

const ICONS: Record<string, [any, any]> = {
  home: ["home", "home-outline"],
  effects: ["sparkles", "sparkles-outline"],
  history: ["images", "images-outline"],
  premium: ["diamond", "diamond-outline"],
  settings: ["settings", "settings-outline"],
};

/**
 * A floating bar rather than a full-width strip.
 *
 * The strip version sat flush against the bottom edge and visually merged
 * with the photo grids above it; detaching it by 12px and rounding it makes
 * the content look like it scrolls *under* something, which is what gives the
 * screen depth. The active tab is marked by a tinted chip, not by a second
 * lime element — on any screen there is exactly one lime call to action.
 */
export default function TabsLayout() {
  const { colors, mode } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const BAR_HEIGHT = 64;
  const BOTTOM = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,

        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: FontWeight.semibold,
          marginTop: 2,
          marginBottom: 6,
        },

        tabBarItemStyle: {
          paddingTop: 8,
        },

        tabBarStyle: {
          position: "absolute",
          left: Spacing.lg,
          right: Spacing.lg,
          bottom: BOTTOM,
          height: BAR_HEIGHT,
          paddingBottom: 0,
          paddingTop: 0,
          borderRadius: Radius.xl,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          ...shadow("md"),
        },

        tabBarBackground: () => (
          <View style={styles.bg}>
            {Platform.OS === "ios" ? (
              <BlurView
                tint={mode === "dark" ? "dark" : "light"}
                intensity={40}
                style={StyleSheet.absoluteFill}
              />
            ) : null}

            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    Platform.OS === "ios" ? colors.glass : colors.glassStrong,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: Radius.xl,
                },
              ]}
            />
          </View>
        ),

        tabBarIcon: ({ focused, color }) => {
          const [filled, outline] = ICONS[route.name] || [
            "ellipse",
            "ellipse-outline",
          ];

          return (
            <View
              style={[
                styles.chip,
                focused && {
                  backgroundColor: colors.brandTertiary,
                },
              ]}
            >
              <Ionicons
                name={focused ? filled : outline}
                size={20}
                color={color}
              />
            </View>
          );
        },
      })}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync().catch(() => {});
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t("tab_home") }} />
      <Tabs.Screen name="effects" options={{ title: t("tab_effects") }} />
      <Tabs.Screen name="history" options={{ title: t("tab_history") }} />
      <Tabs.Screen name="premium" options={{ title: t("tab_premium") }} />
      <Tabs.Screen name="settings" options={{ title: t("tab_settings") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  chip: {
    width: 40,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
