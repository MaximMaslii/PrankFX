import React, { useRef, useState } from "react";
import { StyleSheet, Text, View, PanResponder, LayoutChangeEvent, Animated } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { FontSize, FontWeight, Radius } from "@/src/theme/tokens";
import { useI18n } from "@/src/i18n/I18nProvider";

type Props = {
  beforeUri: string; // uri or data URI
  afterUri: string;
  aspect?: number;
};

export function BeforeAfterSlider({ beforeUri, afterUri, aspect = 1 }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState(0.5);
  const posRef = useRef(0.5);
  const anim = useRef(new Animated.Value(0.5)).current;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gesture) => {
        if (!width) return;
        // treat locationX of gesture: use moveX minus card offset — we use gesture x0 + dx
        const x = gesture.moveX; // absolute; requires offset — simpler: use gestureState via touch
        // Use last known via measure alternative — fallback: normalize by pageX relative to card
      },
    })
  ).current;

  // Simpler responder using event locationX
  const handleTouch = (e: any) => {
    if (!width) return;
    const x = e.nativeEvent.locationX;
    const next = Math.max(0.02, Math.min(0.98, x / width));
    posRef.current = next;
    setPos(next);
    anim.setValue(next);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]} onLayout={onLayout}>
      <View
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        style={{ width: "100%", aspectRatio: aspect, backgroundColor: colors.surfaceTertiary }}
      >
        {/* After (full) */}
        <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        {/* Before clipped */}
        <View style={[StyleSheet.absoluteFillObject, { width: `${pos * 100}%`, overflow: "hidden" }]}>
          <Image
            source={{ uri: beforeUri }}
            style={{ width: width || 1, height: "100%" }}
            contentFit="cover"
          />
        </View>
        {/* Divider + handle */}
        <View style={[styles.divider, { left: `${pos * 100}%`, backgroundColor: "#fff" }]} pointerEvents="none">
          <View style={[styles.handle, { backgroundColor: colors.brand }]}>
            <Ionicons name="code" size={16} color="#fff" style={{ transform: [{ rotate: "90deg" }] }} />
          </View>
        </View>
        {/* Labels */}
        <View style={[styles.label, styles.labelLeft]} pointerEvents="none">
          <Text style={styles.labelText}>{t("before")}</Text>
        </View>
        <View style={[styles.label, styles.labelRight]} pointerEvents="none">
          <Text style={styles.labelText}>{t("after")}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    borderWidth: 1,
  },
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  label: {
    position: "absolute",
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  labelLeft: { left: 12 },
  labelRight: { right: 12 },
  labelText: { color: "#fff", fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
