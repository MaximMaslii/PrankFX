import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function GradientButton({ label, onPress, variant = "primary", loading, disabled, fullWidth = true, icon, style, testID }: Props) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress?.();
  };

  const disabledStyle = disabled ? { opacity: 0.5 } : null;
  const wrapper: ViewStyle = { width: fullWidth ? "100%" : undefined, borderRadius: Radius.pill, overflow: "hidden", ...disabledStyle, ...style };

  if (variant === "primary") {
    return (
      <Pressable testID={testID} onPress={handlePress} disabled={disabled || loading} style={wrapper}>
        <LinearGradient
          colors={colors.brandGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.inner}
        >
          {loading ? <ActivityIndicator color={colors.onBrand} /> : (
            <View style={styles.row}>
              {icon}
              <Text style={[styles.label, { color: colors.onBrand, marginLeft: icon ? 8 : 0 }]}>{label}</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    );
  }
  if (variant === "danger") {
    return (
      <Pressable testID={testID} onPress={handlePress} disabled={disabled || loading} style={[wrapper, { backgroundColor: colors.error }]}>
        <View style={styles.inner}>
          {loading ? <ActivityIndicator color={"#fff"} /> : (
            <View style={styles.row}>
              {icon}
              <Text style={[styles.label, { color: "#fff", marginLeft: icon ? 8 : 0 }]}>{label}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }
  if (variant === "ghost") {
    return (
      <Pressable testID={testID} onPress={handlePress} disabled={disabled || loading} style={[wrapper, { backgroundColor: "transparent" }]}>
        <View style={styles.inner}>
          <View style={styles.row}>
            {icon}
            <Text style={[styles.label, { color: colors.onSurface, marginLeft: icon ? 8 : 0 }]}>{label}</Text>
          </View>
        </View>
      </Pressable>
    );
  }
  // secondary
  return (
    <Pressable testID={testID} onPress={handlePress} disabled={disabled || loading}
      style={[wrapper, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}>
      <View style={styles.inner}>
        {loading ? <ActivityIndicator color={colors.onSurface} /> : (
          <View style={styles.row}>
            {icon}
            <Text style={[styles.label, { color: colors.onSurface, marginLeft: icon ? 8 : 0 }]}>{label}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  label: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, letterSpacing: 0.2 },
});
