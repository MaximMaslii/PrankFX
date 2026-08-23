import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { GenAPI, SubAPI } from "@/src/api/client";
import { CreateFlow } from "@/src/utils/createFlow";
import { toDataUri } from "@/src/utils/images";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function Processing() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scan = useRef(new Animated.Value(0)).current;

  const source = CreateFlow.getSource();
  const effect = CreateFlow.getEffect();

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!generating) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [generating, scan]);

  const generate = async () => {
    if (generating) return;

    if (!source?.base64 || !effect?.effect_id) {
      Toast.error("Missing image or effect");
      router.replace("/home");
      return;
    }

    try {
      setGenerating(true);

      // Check credits before sending the image to Gemini.
      const credits = await SubAPI.credits();

      if (!credits.is_premium && credits.free_credits_remaining <= 0) {
        setGenerating(false);
        router.replace({
          pathname: "/premium",
        });
        return;
      }

      const result = await GenAPI.generate(
        source.base64,
        effect.effect_id,
        true
      );

      CreateFlow.setResult(result);

      router.replace({
        pathname: "/create/result",
        params: { pid: result.project_id },
      });
    } catch (e: any) {
      if (e?.status === 402) {
        setGenerating(false);

        router.replace({
          pathname: "/premium",
        });

        return;
      }

      setGenerating(false);
      Toast.error(e?.message || t("error_generic"));
    }
  };

  const translateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280],
  });

  if (!source?.base64 || !effect?.effect_id) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          padding: Spacing.xl,
        }}
      >
        <Text
          style={{
            color: colors.onSurface,
            fontSize: FontSize.lg,
            fontWeight: FontWeight.bold,
            textAlign: "center",
          }}
        >
          Missing image or effect
        </Text>

        <Pressable
          onPress={() => router.replace("/home")}
          style={{
            marginTop: Spacing.xl,
            backgroundColor: colors.brand,
            paddingHorizontal: Spacing.xl,
            paddingVertical: 14,
            borderRadius: Radius.pill,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: FontWeight.bold,
            }}
          >
            Go Home
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Photo */}
      <Image
        source={{
          uri: toDataUri(source.base64, source.mime),
        }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />

      {/* Dark overlay */}
      <View style={styles.dim} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.headerButton}
          disabled={generating}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>

        <Text style={styles.headerTitle}>
          {effect.effect_name}
        </Text>

        <View style={styles.headerButton} />
      </View>

      {/* Preview / Processing frame */}
      <View style={styles.previewContainer}>
        <Image
          source={{
            uri: toDataUri(source.base64, source.mime),
          }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />

        {generating && (
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <LinearGradient
              colors={["transparent", colors.brand, "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanGradient}
            />
          </Animated.View>
        )}

        {generating && <View style={styles.processingOverlay} />}
      </View>

      {/* Bottom */}
      <View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        {generating ? (
          <>
            <Text style={styles.title}>
              {t("processing_title")}
            </Text>

            <Text style={styles.sub}>
              {t("processing_sub")}
            </Text>

            <Text style={styles.effectName}>
              {effect.effect_name}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              Ready to create?
            </Text>

            <Text style={styles.sub}>
              Apply {effect.effect_name} to this photo
            </Text>

            <Pressable
              testID="generate-btn"
              onPress={generate}
              style={styles.generateButton}
            >
              <LinearGradient
                colors={colors.brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateGradient}
              >
                <Ionicons
                  name="sparkles"
                  size={22}
                  color="#fff"
                />

                <Text style={styles.generateText}>
                  Generate
                </Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  headerTitle: {
    color: "#fff",
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },

  previewContainer: {
    position: "absolute",
    top: 90,
    left: 24,
    right: 24,
    height: 420,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 5,
    zIndex: 5,
  },

  scanGradient: {
    height: 5,
    width: "100%",
  },

  bottom: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 0,
    alignItems: "center",
  },

  title: {
    color: "#fff",
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    textAlign: "center",
  },

  sub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: FontSize.md,
    marginTop: 8,
    textAlign: "center",
  },

  effectName: {
    color: "#FF6B4A",
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginTop: 12,
    letterSpacing: 0.4,
  },

  generateButton: {
    width: "100%",
    marginTop: 24,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },

  generateGradient: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  generateText: {
    color: "#fff",
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});