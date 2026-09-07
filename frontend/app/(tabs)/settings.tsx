import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { SubAPI } from "@/src/api/client";
import { Toast } from "@/src/components/Toast";
import { FontSize, FontWeight, Radius, Spacing } from "@/src/theme/tokens";

export default function Settings() {
  const { colors, preference, setPreference } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { user, logout, deleteAccount } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notif, setNotif] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openLink = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

  const doLogout = async () => {
    await logout();
    router.replace("/auth/login");
  };

  const doDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      Toast.error(t("delete_account_confirm"));
      return;
    }
    await deleteAccount();
    router.replace("/auth/login");
  };

  const restore = async () => {
    try {
      const r = await SubAPI.restore();
      Toast.success(r.is_premium ? "Restored" : "No active subscription");
    } catch { /* noop */ }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 + insets.bottom }}
    >
      <Text style={[styles.h1, { color: colors.onSurface }]}>{t("settings")}</Text>

      {/* Profile card */}
      <View style={[styles.profile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <Text style={styles.avatarText}>{(user?.name || user?.email || "P")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.onSurface }]}>{user?.name || "PrankFX user"}</Text>
          <Text style={[styles.email, { color: colors.onSurfaceTertiary }]}>{user?.email}</Text>
        </View>
        {user?.is_premium && (
          <View style={[styles.badge, { backgroundColor: colors.brand }]}>
            <Ionicons name="diamond" size={12} color="#fff" />
            <Text style={styles.badgeText}>PRO</Text>
          </View>
        )}
      </View>

      <Section title={t("preferences")}>
        <Row testID="settings-language" icon="language" label={t("language")}>
          <View style={styles.segment2}>
            {(["en", "ru", "de"] as const).map((l) => (
              <Pressable
                key={l}
                onPress={() => setLang(l)}
                style={[styles.seg2Item, { backgroundColor: lang === l ? colors.brand : colors.surfaceTertiary }]}
              >
                <Text style={{ color: lang === l ? "#fff" : colors.onSurface, fontWeight: FontWeight.semibold }}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row testID="settings-theme" icon="color-palette" label={t("dark_mode")}>
          <View style={styles.segment2}>
            {(["system", "light", "dark"] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setPreference(k)}
                style={[styles.seg2Item, { backgroundColor: preference === k ? colors.brand : colors.surfaceTertiary }]}
              >
                <Text style={{ color: preference === k ? "#fff" : colors.onSurface, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>{t(k as any)}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row testID="settings-notifications" icon="notifications" label={t("notifications")}>
          <Pressable onPress={() => setNotif(!notif)} style={[styles.switch, { backgroundColor: notif ? colors.brand : colors.surfaceTertiary }]}>
            <View style={[styles.switchDot, { transform: [{ translateX: notif ? 22 : 2 }] }]} />
          </Pressable>
        </Row>
      </Section>

      <Section title={t("account")}>
        <Row testID="settings-restore" icon="refresh" label={t("restore_purchases")} onPress={restore} />
        <Row testID="settings-privacy" icon="shield-checkmark" label={t("privacy")} onPress={() => openLink("https://www.termsfeed.com/live/privacy-policy-example")} />
        <Row testID="settings-terms" icon="document-text" label={t("terms")} onPress={() => openLink("https://www.termsfeed.com/live/terms-conditions-example")} />
        <Row testID="settings-support" icon="help-circle" label={t("support")} onPress={() => openLink("mailto:support@prankfx.app")} />
      </Section>

      <Section title="">
        <Row testID="settings-logout" icon="log-out" label={t("logout")} onPress={doLogout} color={colors.warning} />
        <Row testID="settings-delete" icon="trash" label={t("delete_account")} onPress={doDelete} color={colors.error} />
      </Section>

      <Text style={[styles.version, { color: colors.onSurfaceTertiary }]}>PrankFX • Cinematic AI Effects</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: Spacing.xl }}>
      {!!title && <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>{title.toUpperCase()}</Text>}
      <View style={[styles.group, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({ icon, label, onPress, children, color, testID }: any) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.row, { borderColor: colors.divider }]}>
      <View style={[styles.rowIcon, { backgroundColor: color ? color + "22" : colors.surfaceTertiary }]}>
        <Ionicons name={icon} size={16} color={color || colors.onSurface} />
      </View>
      <Text style={[styles.rowLabel, { color: color || colors.onSurface }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {children || <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { paddingHorizontal: Spacing.xl, fontSize: FontSize.xl3, fontWeight: FontWeight.heavy, letterSpacing: -0.5, marginBottom: Spacing.md },
  profile: {
    marginHorizontal: Spacing.xl, borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.lg, flexDirection: "row", alignItems: "center", gap: Spacing.md,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  email: { fontSize: FontSize.sm, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.6 },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.8, marginLeft: Spacing.xl2, marginBottom: 8 },
  group: { marginHorizontal: Spacing.xl, borderRadius: Radius.lg, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  segment2: { flexDirection: "row", gap: 6, backgroundColor: "transparent" },
  seg2Item: {
    minWidth: 38,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  switch: { width: 46, height: 26, borderRadius: 13, justifyContent: "center" },
  switchDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  version: { textAlign: "center", marginTop: Spacing.xl2, fontSize: FontSize.xs },
});
