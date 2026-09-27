import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme/ThemeProvider";
import { Radius, Spacing } from "@/src/theme/tokens";

/**
 * Loading placeholders shaped like the thing that is coming.
 *
 * A spinner says "wait" and nothing else; a skeleton says "a row of cards is
 * arriving, here is where it will be" — the screen stops jumping when data
 * lands, and the wait measures shorter even though it is not.
 *
 * The pulse is opacity only, on the native driver: animating width or colour
 * here would run on the JS thread and stutter during exactly the moment the
 * app is busy parsing the response.
 */
export function Skeleton({
  width,
  height,
  radius = Radius.md,
  style,
}: {
  width?: number | `${number}%`;
  /** Omit when the caller sizes the block itself (e.g. by aspect ratio). */
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.45, 0.9],
          }),
        },
        style,
      ]}
    />
  );
}

/** A horizontal strip of card placeholders, matching a FlatList row. */
export function SkeletonRow({
  count = 3,
  width,
  height,
  radius = Radius.lg,
}: {
  count?: number;
  width: number;
  height: number;
  radius?: number;
}) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width={width} height={height} radius={radius} />
      ))}
    </View>
  );
}

/** Two-column grid placeholder, matching the effects screen. */
export function SkeletonGrid({
  count = 6,
  aspectRatio = 0.82,
}: {
  count?: number;
  aspectRatio?: number;
}) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: "48%" }}>
          <Skeleton width="100%" radius={Radius.lg} style={{ aspectRatio }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
});
