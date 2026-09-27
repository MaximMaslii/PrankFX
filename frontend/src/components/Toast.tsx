import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import {
  FontSize,
  FontWeight,
  Motion,
  Radius,
  Spacing,
  shadow,
} from "@/src/theme/tokens";

export type ToastKind = "info" | "success" | "error";
export type ToastMessage = { id: number; text: string; kind: ToastKind };

let counter = 0;
const listeners: ((m: ToastMessage) => void)[] = [];

export const Toast = {
  show(text: string, kind: ToastKind = "info") {
    const m: ToastMessage = { id: ++counter, text, kind };
    listeners.forEach((l) => l(m));
  },
  success(text: string) {
    Toast.show(text, "success");
  },
  error(text: string) {
    Toast.show(text, "error");
  },
};

/**
 * Toasts used to be a solid pill in the status colour — a full-width block of
 * red for "wrong password" reads as a crash. Now the surface stays the app's
 * own card colour and the status shows up only in a 3px rail and an icon, so
 * an error informs without shouting. Long messages wrap instead of truncating:
 * the backend's errors are sentences, not words.
 */
export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [current, setCurrent] = React.useState<ToastMessage | null>(null);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;

  useEffect(() => {
    const l = (m: ToastMessage) => setCurrent(m);
    listeners.push(l);

    return () => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    if (!current) return;

    opacity.setValue(0);
    translateY.setValue(-24);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Motion.base,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: Motion.slow,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // Errors carry instructions ("check that the backend is running…"), so
    // they get longer on screen than a success confirmation.
    const life = current.kind === "error" ? 5200 : 2800;

    const to = setTimeout(() => dismiss(), life);

    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: Motion.fast,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -24,
        duration: Motion.fast,
        useNativeDriver: true,
      }),
    ]).start(() => setCurrent(null));
  };

  if (!current) return null;

  const rail =
    current.kind === "success"
      ? colors.success
      : current.kind === "error"
        ? colors.error
        : colors.brand;

  const icon =
    current.kind === "success"
      ? "checkmark-circle"
      : current.kind === "error"
        ? "alert-circle"
        : "information-circle";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + Spacing.md }]}
    >
      <Animated.View
        pointerEvents="auto"
        style={[
          styles.toast,
          shadow("md"),
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.rail, { backgroundColor: rail }]} />

        <Pressable
          onPress={dismiss}
          style={styles.body}
          accessibilityRole="alert"
        >
          <Ionicons name={icon as any} size={18} color={rail} />

          <Text
            testID="toast-text"
            style={[styles.text, { color: colors.onSurface }]}
          >
            {current.text}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    zIndex: 9999,
    elevation: 30,
  },
  toast: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 460,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  rail: {
    width: 3,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  text: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    lineHeight: 19,
  },
});
