/**
 * The offer screen.
 *
 * Shown once after someone's first free result, and whenever they run into
 * the end of their FX. The weekly plan is the headline and the FX packs are
 * the alternative, not the other way round — a subscriber is worth several
 * times what a one-off pack buyer is worth, and at 50 FX a week the price per
 * effect is better for them too, which is what keeps that ordering honest.
 *
 * Everything the two stores require to be on a subscription screen is on it:
 * what you get, what it costs, how long the period is, that it renews by
 * itself, how to stop it, and links to the terms and the privacy policy. A
 * missing line here is a rejected build, not a cosmetic note.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import {
  PurchasesAPI,
  SITE_BASE,
  SubAPI,
  SubscriptionPlan,
} from "@/src/api/client";
import {
  buyPackage,
  findPlanPackage,
  getPackages,
  purchasesAvailable,
  restoreStorePurchases,
} from "@/src/utils/purchases";
import type { PurchasesPackage } from "react-native-purchases";
import { GradientButton } from "@/src/components/GradientButton";
import { Toast } from "@/src/components/Toast";
import { markPaywallOffered } from "@/src/utils/paywall";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
  Tracking,
} from "@/src/theme/tokens";

/** Used only until the store answers with real, localised prices. */
const FALLBACK_PLAN: SubscriptionPlan = {
  id: "weekly",
  product_id: "prankfx_weekly",
  fx: 50,
  price: 6.99,
  period: "week",
  period_days: 7,
};

type Reason = "first_result" | "no_fx" | "snap" | "premium";

export default function Paywall() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { user, isGuest, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ reason?: string }>();

  // Anything unexpected in the param falls back to the default headline
  // rather than rendering `undefined` as the title.
  const REASONS: Reason[] = ["first_result", "no_fx", "snap", "premium"];

  const reason: Reason = REASONS.includes(params.reason as Reason)
    ? (params.reason as Reason)
    : "first_result";

  const [plan, setPlan] = useState<SubscriptionPlan>(FALLBACK_PLAN);
  const [storePackages, setStorePackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const copy = {
    en: {
      kicker: "PrankFX Premium",
      title: {
        first_result: "That was one of one.",
        no_fx: "You're out of FX.",
        snap: "Snap clips need 10 FX.",
        premium: "Go premium.",
      }[reason],
      lead: "A weekly plan keeps them coming — 50 FX every week, no watermark, and the queue skips you to the front.",
      planName: "Weekly",
      per: "per week",
      fxLine: "{fx} FX every week",
      perks: [
        "50 FX a week — about 50 photo effects, or 5 Snap clips",
        "No PrankFX watermark on your clips",
        "Priority processing when the servers are busy",
        "Every effect, including the 18+ ones",
        "New effects every week — the catalogue keeps growing",
      ],
      cta: "Start weekly",
      ctaGuest: "Create an account to subscribe",
      guestNote:
        "A subscription has to belong to an account you can sign back into — otherwise it disappears with the app.",
      packsLink: "Or buy FX once, without a plan",
      restore: "Restore purchases",
      renew:
        "Renews automatically every week until you cancel. Cancel any time in {store}, at least 24 hours before the next charge.",
      terms: "Terms",
      privacy: "Privacy",
      later: "Not now",
      restored: "Purchases restored",
      nothingToRestore: "Nothing to restore on this account",
      thanks: "You're premium. Enjoy.",
      slow: "Payment went through — premium will switch on within a minute.",
    },
    ru: {
      kicker: "PrankFX Premium",
      title: {
        first_result: "Это был один-единственный.",
        no_fx: "FX закончились.",
        snap: "На Snap нужно 10 FX.",
        premium: "Подключите премиум.",
      }[reason],
      lead: "Недельная подписка — 50 FX каждую неделю, без водяного знака и без очереди.",
      planName: "Неделя",
      per: "в неделю",
      fxLine: "{fx} FX каждую неделю",
      perks: [
        "50 FX в неделю — это примерно 50 фото-эффектов или 5 роликов Snap",
        "Без водяного знака PrankFX на видео",
        "Приоритетная обработка, когда серверы загружены",
        "Все эффекты, включая 18+",
        "Обновления эффектов каждую неделю — каталог растёт",
      ],
      cta: "Оформить на неделю",
      ctaGuest: "Создать аккаунт и оформить",
      guestNote:
        "Подписка должна быть привязана к аккаунту, в который вы сможете войти снова — иначе она исчезнет вместе с приложением.",
      packsLink: "Или купить FX разово, без подписки",
      restore: "Восстановить покупки",
      renew:
        "Продлевается автоматически каждую неделю, пока вы не отмените. Отменить можно в {store} не позднее чем за 24 часа до следующего списания.",
      terms: "Условия",
      privacy: "Конфиденциальность",
      later: "Не сейчас",
      restored: "Покупки восстановлены",
      nothingToRestore: "На этом аккаунте нечего восстанавливать",
      thanks: "Премиум активен. Пользуйтесь.",
      slow: "Платёж прошёл — премиум включится в течение минуты.",
    },
    de: {
      kicker: "PrankFX Premium",
      title: {
        first_result: "Das war der eine Freie.",
        no_fx: "Deine FX sind aufgebraucht.",
        snap: "Snap-Clips kosten 10 FX.",
        premium: "Hol dir Premium.",
      }[reason],
      lead: "Das Wochenabo hält es am Laufen — 50 FX pro Woche, kein Wasserzeichen, keine Warteschlange.",
      planName: "Woche",
      per: "pro Woche",
      fxLine: "{fx} FX jede Woche",
      perks: [
        "50 FX pro Woche — etwa 50 Foto-Effekte oder 5 Snap-Clips",
        "Kein PrankFX-Wasserzeichen auf deinen Clips",
        "Bevorzugte Verarbeitung, wenn die Server ausgelastet sind",
        "Alle Effekte, auch die ab 18",
        "Jede Woche neue Effekte — der Katalog wächst",
      ],
      cta: "Wochenabo starten",
      ctaGuest: "Konto erstellen und abonnieren",
      guestNote:
        "Ein Abo muss zu einem Konto gehören, in das du dich wieder einloggen kannst — sonst verschwindet es mit der App.",
      packsLink: "Oder FX einmalig kaufen, ohne Abo",
      restore: "Käufe wiederherstellen",
      renew:
        "Verlängert sich automatisch jede Woche, bis du kündigst. Kündbar jederzeit im {store}, spätestens 24 Stunden vor der nächsten Abbuchung.",
      terms: "AGB",
      privacy: "Datenschutz",
      later: "Jetzt nicht",
      restored: "Käufe wiederhergestellt",
      nothingToRestore: "Auf diesem Konto gibt es nichts wiederherzustellen",
      thanks: "Premium ist aktiv. Viel Spaß.",
      slow: "Zahlung erfolgreich — Premium ist innerhalb einer Minute aktiv.",
    },
  }[lang];

  const storeName = Platform.OS === "ios" ? "App Store" : "Google Play";

  // -----------------------------------------------------------------
  // Load the catalogue.
  // -----------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Showing the screen counts as the offer having been made, whatever the
      // user does next — otherwise a dismissed paywall would come straight
      // back on the next result.
      markPaywallOffered().catch(() => {});

      try {
        const [plans, packages] = await Promise.all([
          SubAPI.plans().catch(() => [] as SubscriptionPlan[]),
          getPackages(),
        ]);

        if (!mounted) return;

        if (plans.length > 0) setPlan(plans[0]);
        setStorePackages(packages);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const storePackage = findPlanPackage(storePackages, plan.id);

  /** The store's own price string, in the user's currency, when we have it. */
  const priceLabel =
    storePackage?.product.priceString ?? `$${plan.price.toFixed(2)}`;

  const storeReady = purchasesAvailable() && !!storePackage;

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  }, [router]);

  /**
   * Wait for premium to actually switch on.
   *
   * The entitlement does not come from this screen: the store tells
   * RevenueCat, RevenueCat calls our webhook, and only then does the account
   * change. That is normally a second or two — long enough that returning to
   * an unchanged screen would look like the payment failed.
   */
  const waitForPremium = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const info = await SubAPI.credits();

        if (info.is_premium) {
          await refresh();
          return true;
        }
      } catch {
        // A dropped poll is not a failed purchase.
      }
    }

    return false;
  };

  const subscribe = async () => {
    // A guest cannot buy. Not a restriction for its own sake: a purchase made
    // under a device-only account is lost the moment the app is reinstalled,
    // and the person who paid has no way to prove it was theirs.
    if (isGuest) {
      Haptics.selectionAsync().catch(() => {});
      router.push({
        pathname: "/auth/register",
        params: { intent: "subscribe" },
      });
      return;
    }

    if (!storePackage) {
      Toast.error(t("purchase_unavailable"));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy(true);

    try {
      const outcome = await buyPackage(storePackage);

      if (outcome.status === "cancelled") return;

      if (outcome.status === "error") {
        Toast.error(outcome.message);
        return;
      }

      Toast.success(t("purchase_pending"));

      if (await waitForPremium()) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});

        Toast.success(copy.thanks);
        close();
      } else {
        Toast.success(copy.slow);
      }
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);

    try {
      // Two steps, because they know different things: the SDK re-reads the
      // receipt on the device, and only our server knows which account it
      // belongs to.
      await restoreStorePurchases();

      const result = await PurchasesAPI.restore();

      await refresh();

      Toast.success(
        result.is_premium ? copy.restored : copy.nothingToRestore,
      );
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  const openLegal = async (page: "terms" | "privacy") => {
    const url = `${SITE_BASE}/${page}?lang=${lang}`;

    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Linking.openURL(url).catch(() => {});
    }
  };

  // Already subscribed: nothing to sell. Reachable if the screen is opened
  // from a stale navigation or straight after a restore.
  const alreadyPremium = !!user?.is_premium;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + 200,
          paddingHorizontal: Spacing.xl,
        }}
      >
        <View style={styles.topRow}>
          <Pressable
            testID="paywall-close"
            onPress={close}
            hitSlop={12}
            style={[
              styles.closeBtn,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Ionicons name="close" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>
        </View>

        <LinearGradient
          colors={colors.premiumGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Ionicons name="diamond" size={13} color="#fff" />
            <Text style={styles.heroBadgeText}>{copy.kicker}</Text>
          </View>

          <Text style={styles.heroTitle}>{copy.title}</Text>
          <Text style={styles.heroLead}>{copy.lead}</Text>
        </LinearGradient>

        {/* The plan card. Price and period sit together, large, because that
            is the one thing the user is actually deciding about. */}
        <View
          style={[
            styles.planCard,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.brand,
            },
          ]}
        >
          <View style={styles.planTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planName, { color: colors.onSurface }]}>
                {copy.planName}
              </Text>

              <Text style={[styles.planFx, { color: colors.brand }]}>
                {copy.fxLine.replace("{fx}", String(plan.fx))}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Text style={[styles.planPrice, { color: colors.onSurface }]}>
                  {priceLabel}
                </Text>
              )}

              <Text
                style={[styles.planPer, { color: colors.onSurfaceTertiary }]}
              >
                {copy.per}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.perks}>
          {copy.perks.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              <View
                style={[
                  styles.perkIcon,
                  { backgroundColor: colors.surfaceTertiary },
                ]}
              >
                <Ionicons name="checkmark" size={14} color={colors.brand} />
              </View>

              <Text style={[styles.perkText, { color: colors.onSurface }]}>
                {perk}
              </Text>
            </View>
          ))}
        </View>

        {isGuest && (
          <View
            style={[
              styles.note,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="person-circle-outline"
              size={18}
              color={colors.onSurfaceTertiary}
            />

            <Text
              style={[styles.noteText, { color: colors.onSurfaceTertiary }]}
            >
              {copy.guestNote}
            </Text>
          </View>
        )}

        <Pressable
          testID="paywall-packs"
          onPress={() => router.replace("/premium")}
          style={styles.linkRow}
        >
          <Text style={[styles.link, { color: colors.onSurfaceTertiary }]}>
            {copy.packsLink}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={15}
            color={colors.onSurfaceTertiary}
          />
        </Pressable>

        {/* Required by both stores on the screen that sells a subscription:
            the renewal terms, how to cancel, and the two legal links. */}
        <Text style={[styles.fine, { color: colors.onSurfaceTertiary }]}>
          {copy.renew.replace("{store}", storeName)}
        </Text>

        <View style={styles.legalRow}>
          <Pressable onPress={() => openLegal("terms")} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.onSurfaceTertiary }]}>
              {copy.terms}
            </Text>
          </Pressable>

          <Text style={{ color: colors.onSurfaceTertiary }}>·</Text>

          <Pressable onPress={() => openLegal("privacy")} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.onSurfaceTertiary }]}>
              {copy.privacy}
            </Text>
          </Pressable>

          <Text style={{ color: colors.onSurfaceTertiary }}>·</Text>

          <Pressable testID="paywall-restore" onPress={restore} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.onSurfaceTertiary }]}>
              {copy.restore}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={[
          styles.sticky,
          {
            paddingBottom: insets.bottom + Spacing.xl,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <GradientButton
          testID="paywall-subscribe"
          label={
            isGuest
              ? copy.ctaGuest
              : !storeReady
                ? t("purchase_unavailable")
                : `${copy.cta} · ${priceLabel}`
          }
          onPress={subscribe}
          loading={busy}
          // A guest always gets a working button — it leads to sign-up, not
          // to a purchase, so the store being unavailable is irrelevant.
          disabled={alreadyPremium || (!isGuest && (!storeReady || loading))}
        />

        <Pressable testID="paywall-later" onPress={close} style={styles.later}>
          <Text style={[styles.laterText, { color: colors.onSurfaceTertiary }]}>
            {copy.later}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: Spacing.sm,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  hero: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(5,4,12,0.32)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.md,
  },

  heroBadgeText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.kicker,
  },

  heroTitle: {
    color: "#fff",
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
    letterSpacing: Tracking.title,
  },

  heroLead: {
    color: "rgba(255,255,255,0.94)",
    fontSize: FontSize.base,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },

  planCard: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },

  planTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  planName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
  },

  planFx: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },

  planPrice: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.heavy,
  },

  planPer: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  perks: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },

  perkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },

  perkIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  perkText: {
    flex: 1,
    fontSize: FontSize.base,
    lineHeight: 20,
  },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },

  noteText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.md,
  },

  link: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },

  fine: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    textAlign: "center",
    marginTop: Spacing.md,
  },

  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },

  legalLink: {
    fontSize: FontSize.xs,
    textDecorationLine: "underline",
  },

  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  later: {
    alignItems: "center",
    paddingTop: Spacing.md,
  },

  laterText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});
