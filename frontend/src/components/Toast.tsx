import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/ThemeProvider";

export type ToastKind = "info" | "success" | "error";
export type ToastMessage = { id: number; text: string; kind: ToastKind };

let counter = 0;
const listeners: ((m: ToastMessage) => void)[] = [];

export const Toast = {
  show(text: string, kind: ToastKind = "info") {
    const m: ToastMessage = { id: ++counter, text, kind };
    listeners.forEach((l) => l(m));
  },
  success(text: string) { Toast.show(text, "success"); },
  error(text: string) { Toast.show(text, "error"); },
};

export function ToastHost() {
  const { colors } = useTheme();
  const [current, setCurrent] = React.useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    const l = (m: ToastMessage) => setCurrent(m);
    listeners.push(l);
    return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
  }, []);

  useEffect(() => {
    if (!current) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
    const to = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 220, useNativeDriver: true }),
      ]).start(() => setCurrent(null));
    }, 2600);
    return () => clearTimeout(to);
  }, [current, opacity, translateY]);

  if (!current) return null;

  const bg = current.kind === "success" ? colors.success : current.kind === "error" ? colors.error : colors.surfaceInverse;
  const fg = current.kind === "info" ? colors.onSurfaceInverse : "#fff";

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View
        style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}
        pointerEvents="auto"
      >
        <TouchableOpacity activeOpacity={0.8} onPress={() => setCurrent(null)}>
          <Text testID="toast-text" style={[styles.text, { color: fg }]}>{current.text}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    elevation: 30,
  },
  toast: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, textAlign: "center" },
});
