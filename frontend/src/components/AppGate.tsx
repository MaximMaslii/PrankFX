/**
 * Server-controlled full-screen gates, driven by GET /api/app/config.
 *
 *   • maintenance  — APP_MAINTENANCE=true in backend/.env
 *   • update       — installed version is below APP_MIN_VERSION
 *
 * Both are switched on the SERVER, so a live app can be told to wait or to
 * update without shipping anything. When the server cannot be reached the
 * gate stays out of the way — an unreachable config must never lock people
 * out of the app.
 */
import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { AppConfig, AppConfigAPI } from "@/src/api/client";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { FontFamily, FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

/** "1.10.0" > "1.9.3". Missing parts count as 0; junk counts as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }

  return 0;
}

const APP_VERSION = Constants.expoConfig?.version || "0.0.0";

export function AppGate() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const [config, setConfig] = useState<AppConfig | null>(null);

  const load = useCallback(async () => {
    try {
      setConfig(await AppConfigAPI.get());
    } catch {
      // Unreachable server: never block the app on a missing config.
    }
  }, []);

  useEffect(() => {
    load();

    // Re-check on return to the app, so lifting maintenance mode frees
    // people without them having to restart.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") load();
    });

    return () => sub.remove();
  }, [load]);

  if (!config) return null;

  const tooOld =
    !!config.min_version && compareVersions(APP_VERSION, config.min_version) < 0;

  if (!config.maintenance && !tooOld) return null;

  const storeUrl = Platform.OS === "ios" ? config.store_url.ios : config.store_url.android;

  const title = tooOld ? t("gate_update_title") : t("gate_maint_title");
  const body = tooOld
    ? t("gate_update_body")
    : config.maintenance_message?.[lang] || t("gate_maint_body");

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.surface }]}>
      <LinearGradient colors={colors.bgGradient} style={StyleSheet.absoluteFill} />

      <View style={[styles.icon, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Ionicons name={tooOld ? "rocket" : "construct"} size={34} color={colors.brand} />
      </View>

      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.onSurfaceTertiary }]}>{body}</Text>

      {tooOld && storeUrl ? (
        <Pressable onPress={() => Linking.openURL(storeUrl).catch(() => {})} style={styles.ctaWrap}>
          <LinearGradient
            colors={colors.brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={[styles.ctaText, { color: colors.onBrand }]}>{t("gate_update_cta")}</Text>
          </LinearGradient>
        </Pressable>
      ) : (
        <Pressable onPress={load} style={[styles.ghost, { borderColor: colors.border }]}>
          <Text style={[styles.ctaText, { color: colors.onSurface }]}>{t("gate_retry")}</Text>
        </Pressable>
      )}

      <Text style={[styles.version, { color: colors.onSurfaceTertiary }]}>v{APP_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 10000,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl2,
    gap: Spacing.md,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl2,
    lineHeight: 30,
    textAlign: "center",
  },
  body: { fontSize: FontSize.md, lineHeight: 22, textAlign: "center" },
  ctaWrap: { alignSelf: "stretch", marginTop: Spacing.lg },
  cta: { height: 54, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  ghost: {
    alignSelf: "stretch",
    marginTop: Spacing.lg,
    height: 54,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  version: { position: "absolute", bottom: Spacing.xl2, fontSize: FontSize.xs },
});
