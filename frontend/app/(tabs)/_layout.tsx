import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { FontSize, FontWeight } from "@/src/theme/tokens";

export default function TabsLayout() {
  const { colors, mode } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const tabHeight = 60 + insets.bottom;

  const iconFor = (name: string, focused: boolean, color: string) => {
    const map: Record<string, [any, any]> = {
      home: ["home", "home-outline"],
      effects: ["sparkles", "sparkles-outline"],
      history: ["images", "images-outline"],
      premium: ["star", "star-outline"],
      settings: ["settings", "settings-outline"],
    };
    const [filled, outline] = map[name] || ["ellipse", "ellipse-outline"];
    return <Ionicons name={focused ? filled : outline} size={22} color={color} />;
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: -2 },
        tabBarIconStyle: { marginTop: 4 },
        tabBarStyle: {
          position: "absolute",
          height: tabHeight,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: Platform.OS === "android" ? colors.glassStrong : "transparent",
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView tint={mode === "dark" ? "dark" : "light"} intensity={80} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassStrong }]} />
          ),
        tabBarIcon: ({ focused, color }) => iconFor(route.name, focused, color),
      })}
      screenListeners={{
        tabPress: () => { Haptics.selectionAsync().catch(() => {}); },
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
