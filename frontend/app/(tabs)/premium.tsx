import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { useI18n } from "@/src/i18n/I18nProvider";
import { useAuth } from "@/src/auth/AuthProvider";
import { FXPack, SubAPI } from "@/src/api/client";
import {
  buyPackage,
  getPackages,
  packIdForProduct,
  purchasesAvailable,
} from "@/src/utils/purchases";
import type { PurchasesPackage } from "react-native-purchases";
import { GradientButton } from "@/src/components/GradientButton";
import { Toast } from "@/src/components/Toast";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
} from "@/src/theme/tokens";

const FALLBACK_PACKS: FXPack[] = [
  { id: "starter", fx: 5, price: 0.99 },
  { id: "basic", fx: 15, price: 2.49 },
  { id: "popular", fx: 40, price: 6.99 },
  { id: "pro", fx: 100, price: 14.99 },
  { id: "ultimate", fx: 250, price: 34.99 },
];

export default function PremiumScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { user, isGuest, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [packs, setPacks] = useState<FXPack[]>([]);
  const [balance, setBalance] = useState<number>(user?.fx_credits ?? 0);
  const [selectedPack, setSelectedPack] = useState<string>("popular");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // Packages as the store itself reports them — localised prices, and proof
  // that the product really exists in Play/App Store Connect.
  const [storePackages, setStorePackages] = useState<PurchasesPackage[]>([]);

  const text = {
    en: {
      store: "FX Store",
      balance: "Your FX balance",
      info: "Use FX to create AI edits. Every successful generation costs exactly 1 FX.",
      choose: "Choose your FX",
      generations: "AI generations",
      mostPopular: "MOST POPULAR",
      bestValue: "BEST VALUE",
      neverExpires: "FX never expires and can be used for any available AI effect.",
      buy: "Buy",
      buyFx: "Buy FX",
      perFx: "/ FX",
      planKicker: "BETTER VALUE",
      planTitle: "50 FX every week",
      planSub: "Weekly plan · no watermark · priority processing",
      guestNeeded: "Create an account first — a purchase has to belong to one.",
    },
    ru: {
      store: "Магазин FX",
      balance: "Ваш баланс FX",
      info: "Используйте FX для создания AI-эффектов. Каждая успешная генерация стоит ровно 1 FX.",
      choose: "Выберите FX",
      generations: "AI-генераций",
      mostPopular: "САМОЕ ПОПУЛЯРНОЕ",
      bestValue: "ВЫГОДНО",
      neverExpires: "FX не сгорают и могут использоваться для любого доступного AI-эффекта.",
      buy: "Купить",
      buyFx: "Купить FX",
      perFx: "/ FX",
      planKicker: "ВЫГОДНЕЕ",
      planTitle: "50 FX каждую неделю",
      planSub: "Недельная подписка · без водяного знака · без очереди",
      guestNeeded: "Сначала создайте аккаунт — покупка должна быть к нему привязана.",
    },
    de: {
      store: "FX Store",
      balance: "Dein FX-Guthaben",
      info: "Verwende FX für KI-Effekte. Jede erfolgreiche Generierung kostet genau 1 FX.",
      choose: "Wähle deine FX",
      generations: "KI-Generierungen",
      mostPopular: "AM BELIEBTESTEN",
      bestValue: "BESTES ANGEBOT",
      neverExpires: "FX verfallen nicht und können für jeden verfügbaren KI-Effekt verwendet werden.",
      buy: "Kaufen",
      buyFx: "FX kaufen",
      perFx: "/ FX",
      planKicker: "GÜNSTIGER",
      planTitle: "50 FX jede Woche",
      planSub: "Wochenabo · kein Wasserzeichen · bevorzugte Verarbeitung",
      guestNeeded: "Erst ein Konto anlegen — ein Kauf muss zu einem gehören.",
    },
  }[lang];

  const loadFX = async () => {
    try {
      setLoading(true);

      const [packsResult, balanceResult, storeResult] = await Promise.all([
        SubAPI.fxPacks(),
        SubAPI.fxBalance(),
        getPackages(),
      ]);

      setPacks(packsResult);
      setBalance(balanceResult.fx_credits);
      setStorePackages(storeResult);

      if (
        packsResult.length > 0 &&
        !packsResult.some((pack) => pack.id === selectedPack)
      ) {
        setSelectedPack(
          packsResult.find((pack) => pack.id === "popular")?.id ??
            packsResult[0].id,
        );
      }
    } catch (e: any) {
      setPacks(FALLBACK_PACKS);
      setBalance(user?.fx_credits ?? 0);

      Toast.error(e?.message || t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFX();
  }, []);

  /** The store package that corresponds to one of our FX packs, if any. */
  const storePackageFor = (packId: string) =>
    storePackages.find(
      (item) => packIdForProduct(item.product.identifier) === packId,
    );

  /**
   * Wait for the balance to move after a successful payment.
   *
   * The credit does not come from this screen — the store tells RevenueCat,
   * RevenueCat calls our webhook, and only then does the balance change. That
   * round trip is usually a second or two, so the screen waits rather than
   * showing an unchanged balance and looking like the purchase failed.
   */
  const waitForCredit = async (before: number): Promise<boolean> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const result = await SubAPI.fxBalance();

        if (result.fx_credits > before) {
          setBalance(result.fx_credits);
          await refresh();
          return true;
        }
      } catch {
        // Keep waiting; a dropped poll is not a failed purchase.
      }
    }

    return false;
  };

  const purchase = async () => {
    const pack = packs.find((item) => item.id === selectedPack);

    if (!pack || purchasing) return;

    // A purchase made under a device-only account disappears with the app,
    // and the person who paid has no way to prove it was theirs. So the
    // account comes first — one tap with Google or Apple, and the FX,
    // history and user id they already have are carried over intact.
    if (isGuest) {
      Toast.error(text.guestNeeded);
      router.push({
        pathname: "/auth/register",
        params: { intent: "purchase" },
      });
      return;
    }

    const storePackage = storePackageFor(pack.id);

    if (!storePackage) {
      // No product in the store — either the build has no RevenueCat keys or
      // the product id does not match. Never silently "grant" the pack.
      Toast.error(t("purchase_unavailable"));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    setPurchasing(true);

    const before = balance;

    try {
      const outcome = await buyPackage(storePackage);

      if (outcome.status === "cancelled") {
        return;
      }

      if (outcome.status === "error") {
        Toast.error(outcome.message);
        return;
      }

      Toast.success(t("purchase_pending"));

      const credited = await waitForCredit(before);

      if (credited) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});

        Toast.success(`+${pack.fx} FX`);
      } else {
        // The payment went through; the webhook is just late. Nothing is
        // lost, and saying so is better than an error the user cannot act on.
        Toast.success(t("purchase_slow"));
      }
    } catch (e: any) {
      Toast.error(e?.message || t("error_generic"));
    } finally {
      setPurchasing(false);
    }
  };

  /**
   * Whether anything can actually be bought: the SDK is configured AND the
   * store returned at least one product matching our catalogue.
   */
  const storeReady = purchasesAvailable() && storePackages.length > 0;

  /** Store price when the store knows it, our catalogue price otherwise. */
  const priceLabel = (price: number) => `$${price.toFixed(2)}`;

  const packPrice = (pack: FXPack) =>
    storePackageFor(pack.id)?.product.priceString ?? priceLabel(pack.price);

  const selected = packs.find((pack) => pack.id === selectedPack);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: 180 + insets.bottom,
          paddingHorizontal: Spacing.xl,
        }}
      >
        <View
          style={[
            styles.header,
            { marginBottom: Spacing.xl },
          ]}
        >
          <View
            style={[
              styles.fxIcon,
              { backgroundColor: colors.brand },
            ]}
          >
            <Ionicons
              name="flash"
              size={28}
              color={colors.onBrand}
            />
          </View>

          <Text
            style={[
              styles.h1,
              { color: colors.onSurface },
            ]}
          >
            {text.store}
          </Text>

          <Text
            style={[
              styles.sub,
              { color: colors.onSurfaceTertiary },
            ]}
          >
            {t("generation_cost")}
          </Text>
        </View>

        <LinearGradient
          colors={colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceIcon}>
            <Ionicons
              name="flash"
              size={22}
              color={colors.onBrand}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.balanceLabel, { color: colors.onBrand, opacity: 0.8 }]}>
              {text.balance}
            </Text>

            <Text style={[styles.balanceValue, { color: colors.onBrand }]}>
              {loading ? "..." : balance}
            </Text>
          </View>

          <Text style={[styles.balanceUnit, { color: colors.onBrand }]}>
            FX
          </Text>
        </LinearGradient>

        {/* The plan, first. Someone opening the FX shop is already willing
            to pay — this is the moment to show them the offer that costs
            less per effect and does not run out mid-prank. */}
        {!user?.is_premium && (
          <Pressable
            testID="fx-plan-banner"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push({
                pathname: "/paywall",
                params: { reason: "premium" },
              });
            }}
            style={{ marginBottom: Spacing.md }}
          >
            <LinearGradient
              colors={colors.premiumGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planBanner}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.planKicker}>{text.planKicker}</Text>
                <Text style={styles.planTitle}>{text.planTitle}</Text>
                <Text style={styles.planSub}>{text.planSub}</Text>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}

        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="sparkles"
            size={20}
            color={colors.brand}
          />

          <Text
            style={[
              styles.infoText,
              { color: colors.onSurface },
            ]}
          >
            {text.info}
          </Text>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            { color: colors.onSurface },
          ]}
        >
          {text.choose}
        </Text>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator
              size="large"
              color={colors.brand}
            />
          </View>
        ) : (
          packs.map((pack) => {
            const active = selectedPack === pack.id;
            const isPopular = pack.id === "popular";
            const isBestValue = pack.id === "ultimate";

            return (
              <Pressable
                key={pack.id}
                testID={`fx-pack-${pack.id}`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedPack(pack.id);
                }}
                style={{ marginBottom: Spacing.md }}
              >
                <LinearGradient
                  colors={
                    active
                      ? colors.brandGradient
                      : [
                          colors.surfaceSecondary,
                          colors.surfaceSecondary,
                        ]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.packCard,
                    {
                      borderColor: active
                        ? "transparent"
                        : colors.border,
                    },
                  ]}
                >
                  {(isPopular || isBestValue) && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: active
                            ? "rgba(0,0,0,0.30)"
                            : colors.brand,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: active ? "#fff" : colors.onBrand },
                        ]}
                      >
                        {isPopular
                          ? text.mostPopular
                          : text.bestValue}
                      </Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.packTop,
                      {
                        marginTop:
                          isPopular || isBestValue ? 8 : 0,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.packIcon,
                        {
                          backgroundColor: active
                            ? "rgba(255,255,255,0.20)"
                            : colors.surface,
                        },
                      ]}
                    >
                      <Ionicons
                        name="flash"
                        size={24}
                        color={
                          active ? colors.onBrand : colors.brand
                        }
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.packFX,
                          {
                            color: active
                              ? colors.onBrand
                              : colors.onSurface,
                          },
                        ]}
                      >
                        {pack.fx} FX
                      </Text>

                      <Text
                        style={[
                          styles.perGeneration,
                          {
                            color: active
                              ? colors.onBrand
                              : colors.onSurfaceTertiary,
                            opacity: active ? 0.75 : 1,
                          },
                        ]}
                      >
                        {pack.fx} {text.generations}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[
                          styles.price,
                          {
                            color: active
                              ? colors.onBrand
                              : colors.onSurface,
                          },
                        ]}
                      >
                        {packPrice(pack)}
                      </Text>

                      <Text
                        style={[
                          styles.perFX,
                          {
                            color: active
                              ? colors.onBrand
                              : colors.onSurfaceTertiary,
                            opacity: active ? 0.75 : 1,
                          },
                        ]}
                      >
                        {priceLabel(pack.price / pack.fx)}{" "}
                        {text.perFx}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })
        )}

        <Text
          style={[
            styles.disclaimer,
            {
              color: colors.onSurfaceTertiary,
            },
          ]}
        >
          {text.neverExpires}
        </Text>
      </ScrollView>

      <View
        style={[
          styles.stickyCta,
          {
            paddingBottom: insets.bottom + 80,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <GradientButton
          testID="fx-purchase-cta"
          label={
            !storeReady
              ? t("purchase_unavailable")
              : selected
                ? `${text.buy} ${selected.fx} FX • ${packPrice(selected)}`
                : text.buyFx
          }
          onPress={purchase}
          loading={purchasing}
          // A button that cannot buy anything should say so rather than fail
          // on tap: this is the state on the web build, and on any build
          // without RevenueCat keys or store products.
          disabled={!storeReady || loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
  },

  fxIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },

  h1: {
    fontSize: FontSize.xl3,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },

  sub: {
    fontSize: FontSize.base,
    marginTop: 4,
  },

  balanceCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },

  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },

  balanceLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  balanceValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: FontWeight.heavy,
    marginTop: 2,
  },

  balanceUnit: {
    color: "#fff",
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },

  planBanner: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },

  planKicker: {
    color: "rgba(255,255,255,0.85)",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: 1,
  },

  planTitle: {
    color: "#fff",
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    marginTop: 2,
  },

  planSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: FontSize.xs,
    marginTop: 3,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },

  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },

  loader: {
    paddingVertical: 50,
    alignItems: "center",
  },

  packCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  badgeText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
  },

  packTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  packIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },

  packFX: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
  },

  perGeneration: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  price: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
  },

  perFX: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  disclaimer: {
    fontSize: FontSize.xs,
    textAlign: "center",
    marginTop: Spacing.md,
    paddingHorizontal: 30,
  },

  stickyCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
