import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { CreateFlow } from "@/src/utils/createFlow";
import { pickFromGallery, takePhoto } from "@/src/utils/picker";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function PickSource() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const effect = CreateFlow.getEffect();

  const start = async (kind: "camera" | "gallery") => {
    const pick = kind === "camera" ? await takePhoto() : await pickFromGallery();
    if (!pick) return;
    CreateFlow.setSource(pick.base64, pick.mime);
    router.push("/create/processing");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: Spacing.xl }}>
      <Pressable testID="pick-source-back" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
      </Pressable>

      <Text style={[styles.h1, { color: colors.onSurface }]}>Select a photo</Text>
      <Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>
        Applying: <Text style={{ color: colors.brand, fontWeight: FontWeight.bold }}>{effect?.effect_name || "—"}</Text>
      </Text>

      <View style={styles.actions}>
        <Card testID="source-camera" label={t("take_photo")} icon="camera" gradient={colors.brandGradient} onPress={() => start("camera")} />
        <Card testID="source-gallery" label={t("upload_photo")} icon="images" gradient={["#2C2C2E", "#1C1C1E"]} onPress={() => start("gallery")} />
      </View>
    </View>
  );
}

function Card({ label, icon, gradient, onPress, testID }:
  { label: string; icon: any; gradient: [string, string]; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Ionicons name={icon} size={38} color="#fff" />
        <Text style={styles.cardText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", padding: 6 },
  h1: { fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, marginTop: Spacing.md, letterSpacing: -0.5 },
  sub: { fontSize: FontSize.md, marginTop: 6, marginBottom: Spacing.xl },
  actions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  card: {
    borderRadius: Radius.lg, padding: Spacing.xl, minHeight: 180, justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  cardText: { color: "#fff", fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: Spacing.md },
});
