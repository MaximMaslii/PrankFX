import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { GenAPI } from "@/src/api/client";
import { CreateFlow } from "@/src/utils/createFlow";
import { toDataUri } from "@/src/utils/images";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Spacing } from "@/src/theme/tokens";

export default function Processing() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scan = useRef(new Animated.Value(0)).current;
  const source = CreateFlow.getSource();
  const effect = CreateFlow.getEffect();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [scan]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!source?.base64 || !effect?.effect_id) {
        Toast.error("Missing image or effect");
        router.replace("/home");
        return;
      }
      try {
        const r = await GenAPI.generate(source.base64, effect.effect_id, true);
        if (cancelled) return;
        CreateFlow.setResult(r);
        router.replace({ pathname: "/create/result", params: { pid: r.project_id } });
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.status === 402 ? t("premium_required") : (e?.message || t("error_generic"));
        Toast.error(msg);
        if (e?.status === 402) router.replace("/premium");
        else router.replace("/home");
      }
    })();
    return () => { cancelled = true; };
  }, [source, effect, router, t]);

  const translateY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, 280] });

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {source?.base64 && (
        <Image source={{ uri: toDataUri(source.base64, source.mime) }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      )}
      <View style={styles.dim} />

      <View style={{ position: "absolute", top: 80, left: 24, right: 24, height: 320, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: colors.brand }}>
        {source?.base64 && (
          <Image source={{ uri: toDataUri(source.base64, source.mime) }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        )}
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 4, transform: [{ translateY }] }}>
          <LinearGradient
            colors={["transparent", colors.brand, "transparent"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 4 }}
          />
        </Animated.View>
      </View>

      <View style={[styles.text, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.title}>{t("processing_title")}</Text>
        <Text style={styles.sub}>{t("processing_sub")}</Text>
        <Text style={styles.effectName}>{effect?.effect_name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  text: { position: "absolute", left: 24, right: 24, bottom: 0, alignItems: "center" },
  title: { color: "#fff", fontSize: FontSize.xl2, fontWeight: FontWeight.heavy, textAlign: "center" },
  sub: { color: "rgba(255,255,255,0.7)", fontSize: FontSize.md, marginTop: 8, textAlign: "center" },
  effectName: { color: "#FF6B4A", fontSize: FontSize.base, fontWeight: FontWeight.semibold, marginTop: 12, letterSpacing: 0.4 },
});
