import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import {
  FontSize,
  FontWeight,
  Motion,
  Radius,
  Spacing,
  glow,
} from "@/src/theme/tokens";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

/**
 * The one button in the app.
 *
 * `primary` is lime and glows — there is at most one on a screen, and it is
 * always the thing the screen exists for. `accent` (magenta) is for actions
 * that cost FX or money. Everything else is quiet: an outline or bare text.
 *
 * Every press sinks the button 3% and fires a haptic, so the control answers
 * before the network does.
 */
export function GradientButton({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading,
  disabled,
  fullWidth = true,
  icon,
  style,
  testID,
}: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const inactive = disabled || loading;

  const press = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  const handlePress = () => {
    if (inactive) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress?.();
  };

  const height = size === "lg" ? 56 : 46;
  const radius = Radius.md;

  const wrapper: ViewStyle = {
    width: fullWidth ? "100%" : undefined,
    borderRadius: radius,
    opacity: disabled ? 0.45 : 1,
    ...style,
  };

  const inner: ViewStyle = {
    height,
    borderRadius: radius,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  const content = (labelColor: string) =>
    loading ? (
      <ActivityIndicator color={labelColor} />
    ) : (
      <View style={styles.row}>
        {icon}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: labelColor,
              marginLeft: icon ? 8 : 0,
              fontSize: size === "lg" ? FontSize.lg : FontSize.base,
            },
          ]}
        >
          {label}
        </Text>
      </View>
    );

  const body = () => {
    if (variant === "primary") {
      return (
        <LinearGradient
          colors={colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={inner}
        >
          {content(colors.onBrand)}
        </LinearGradient>
      );
    }

    if (variant === "accent") {
      return (
        <View style={[inner, { backgroundColor: colors.accent }]}>
          {content(colors.onAccent)}
        </View>
      );
    }

    if (variant === "danger") {
      return (
        <View style={[inner, { backgroundColor: colors.error }]}>
          {content("#FFFFFF")}
        </View>
      );
    }

    if (variant === "ghost") {
      return (
        <View style={[inner, { backgroundColor: "transparent" }]}>
          {content(colors.onSurfaceTertiary)}
        </View>
      );
    }

    // secondary — an outline that borrows the accent only on its border
    return (
      <View
        style={[
          inner,
          {
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.borderStrong,
          },
        ]}
      >
        {content(colors.onSurface)}
      </View>
    );
  };

  const glowStyle =
    inactive || variant === "ghost" || variant === "secondary"
      ? null
      : variant === "primary"
        ? glow(colors.glowBrand, "md")
        : variant === "accent"
          ? glow(colors.glowAccent, "md")
          : null;

  return (
    <Animated.View style={[wrapper, glowStyle, { transform: [{ scale }] }]}>
      <Pressable
        testID={testID}
        onPress={handlePress}
        onPressIn={() => !inactive && press(Motion.pressScale)}
        onPressOut={() => press(1)}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        style={{ borderRadius: radius }}
      >
        {body()}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: FontWeight.bold,
    letterSpacing: 0.2,
  },
});
