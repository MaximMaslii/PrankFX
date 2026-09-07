import React from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Radius } from "@/src/theme/tokens";

type Props = {
  children: React.ReactNode;
  intensity?: number;
  radius?: number;
  style?: ViewStyle;
  bordered?: boolean;
};

export function GlassCard({ children, intensity = 40, radius = Radius.lg, style, bordered = true }: Props) {
  const { colors, mode } = useTheme();
  const borderStyle: ViewStyle = bordered
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }
    : {};

  if (Platform.OS === "android") {
    return (
      <View style={[{ backgroundColor: colors.glassStrong, borderRadius: radius, overflow: "hidden" }, borderStyle, style]}>
        {children}
      </View>
    );
  }
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, borderStyle, style]}>
      <BlurView tint={mode === "dark" ? "dark" : "light"} intensity={intensity} style={StyleSheet.absoluteFill} />
      <View style={{ backgroundColor: colors.glass }}>{children}</View>
    </View>
  );
}
