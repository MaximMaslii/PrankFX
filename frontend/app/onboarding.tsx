import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { storage } from "@/src/utils/storage";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Tracking,
} from "@/src/theme/tokens";
import { GradientButton } from "@/src/components/GradientButton";
import { HookTitle } from "@/src/components/HookTitle";
import { getEffectThumbSource } from "@/src/utils/images";
import { SNAP_HERO_EFFECTS, snapEmojiFor, snapGradientFor } from "@/src/utils/snapEffects";

const { width, height } = Dimensions.get("window");

/**
 * Slide one is the hook — the video effects nobody has seen yet — and it is
 * drawn, not photographed, so it is on screen the instant the app opens.
 * The others use the artwork bundled with the app instead of remote stock
 * photos, which used to load (or not) over a first-launch network.
 */
const SLIDES = [
  { key: "1", img: null, titleKey: "onboarding_1_title", subKey: "onboarding_1_sub" },
  { key: "2", img: getEffectThumbSource("hollywood_explosion"), titleKey: "onboarding_2_title", subKey: "onboarding_2_sub" },
  { key: "3", img: getEffectThumbSource("car_accident"), titleKey: "onboarding_3_title", subKey: "onboarding_3_sub" },
  { key: "4", img: getEffectThumbSource("house_fire"), titleKey: "onboarding_4_title", subKey: "onboarding_4_sub" },
] as const;

/** Floating effect bubbles for the hook slide. */
function HookArt() {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const up = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const down = float.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={["#1B0F3D", "#3A0F4A", "#0D0B1A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.bubbles}>
        {SNAP_HERO_EFFECTS.slice(0, 8).map((id, i) => (
          <Animated.View
            key={id}
            style={[styles.bubbleWrap, { transform: [{ translateY: i % 2 === 0 ? up : down }] }]}
          >
            <LinearGradient
              colors={snapGradientFor(id)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bubble}
            >
              <Text style={styles.bubbleEmoji}>{snapEmojiFor(id)}</Text>
            </LinearGradient>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await storage.setItem("prankfx.onboarded", true);
    router.replace("/auth/login");
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        renderItem={({ item, index: i }) => (
          <View style={{ width, height }}>
            {item.img === null ? (
              <HookArt />
            ) : (
              <Image
                source={item.img}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={300}
              />
            )}

            {/* Three stops rather than two: the middle one keeps the subject's
                face out of the murk while the text below still gets a solid
                bed to sit on. */}
            <LinearGradient
              colors={
                item.img === null
                  ? ["transparent", "transparent", colors.scrim]
                  : ["rgba(5,4,12,0.15)", "rgba(5,4,12,0.55)", colors.scrim]
              }
              locations={[0, 0.52, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            {/* A thin brand wash at the bottom ties the photography to the
                palette — without it the slides look like stock images. */}
            <LinearGradient
              colors={["transparent", "rgba(124,92,255,0.18)"]}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={[styles.textBlock, { bottom: insets.bottom + 170 }]}>
              <Text style={[styles.step, { color: colors.brand }]}>
                {String(i + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
              </Text>

              {item.img === null ? (
                <HookTitle size={30} style={{ marginBottom: Spacing.md }} />
              ) : (
                <Text style={styles.title}>{t(item.titleKey as any)}</Text>
              )}
              <Text style={styles.sub}>{t(item.subKey as any)}</Text>
            </View>
          </View>
        )}
      />

      {/* Skip */}
      {index < SLIDES.length - 1 && (
        <Pressable
          testID="onboarding-skip"
          onPress={finish}
          style={[styles.skip, { top: insets.top + 12 }]}
          hitSlop={8}
        >
          <Text style={styles.skipText}>{t("skip")}</Text>
        </Pressable>
      )}

      {/* Dots + CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === index ? 26 : 8,
                  backgroundColor:
                    i === index ? colors.brand : "rgba(255,255,255,0.35)",
                },
              ]}
            />
          ))}
        </View>

        <GradientButton
          testID="onboarding-cta"
          label={index === SLIDES.length - 1 ? t("start") : t("next")}
          onPress={next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  bubbles: {
    position: "absolute",
    top: height * 0.14,
    left: Spacing.xl,
    right: Spacing.xl,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 18,
  },
  bubbleWrap: { width: (width - Spacing.xl * 2 - 18 * 3) / 4 },
  bubble: {
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  bubbleEmoji: { fontSize: 32 },

  textBlock: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl,
  },

  step: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.kicker,
    marginBottom: Spacing.sm,
  },

  title: {
    color: "#fff",
    fontSize: FontSize.xl3,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.display,
    marginBottom: Spacing.md,
  },

  sub: {
    color: "rgba(255,255,255,0.86)",
    fontSize: FontSize.lg,
    lineHeight: 23,
  },

  skip: {
    position: "absolute",
    right: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(5,4,12,0.45)",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  skipText: {
    color: "#fff",
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },

  footer: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: 0,
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: Spacing.xl,
  },

  dot: {
    height: 8,
    borderRadius: 4,
  },
});
