import React, { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { storage } from "@/src/utils/storage";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";
import { GradientButton } from "@/src/components/GradientButton";
import { CATEGORY_HERO } from "@/src/utils/images";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  { key: "1", img: CATEGORY_HERO.face, titleKey: "onboarding_1_title", subKey: "onboarding_1_sub" },
  { key: "2", img: CATEGORY_HERO.object, titleKey: "onboarding_2_title", subKey: "onboarding_2_sub" },
  { key: "3", img: CATEGORY_HERO.vehicle, titleKey: "onboarding_3_title", subKey: "onboarding_3_sub" },
  { key: "4", img: CATEGORY_HERO.house, titleKey: "onboarding_4_title", subKey: "onboarding_4_sub" },
] as const;

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
    <View style={[styles.container, { backgroundColor: "#0c0c0c" }]}>
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
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <Image source={{ uri: item.img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
            <LinearGradient
              colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.textBlock, { bottom: insets.bottom + 160 }]}>
              <Text style={styles.title}>{t(item.titleKey as any)}</Text>
              <Text style={styles.sub}>{t(item.subKey as any)}</Text>
            </View>
          </View>
        )}
      />

      {/* Skip */}
      {index < SLIDES.length - 1 && (
        <Pressable testID="onboarding-skip" onPress={finish} style={[styles.skip, { top: insets.top + 12 }]}>
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
                { width: i === index ? 22 : 8, backgroundColor: i === index ? colors.brand : "rgba(255,255,255,0.4)" },
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
  textBlock: { position: "absolute", left: Spacing.xl, right: Spacing.xl },
  title: { color: "#fff", fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, letterSpacing: -0.5, marginBottom: 12 },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: FontSize.lg, lineHeight: 22 },
  skip: { position: "absolute", right: Spacing.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: Radius.pill },
  skipText: { color: "#fff", fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  footer: { position: "absolute", left: Spacing.xl, right: Spacing.xl, bottom: 0 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: Spacing.xl },
  dot: { height: 8, borderRadius: 4 },
});
