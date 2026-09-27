/**
 * In-app purchases through RevenueCat.
 *
 * Division of labour, and the reason for it: the app may only *start* a
 * purchase. It never tells the server what was bought — the store confirms
 * the payment to RevenueCat, RevenueCat calls our webhook, and the backend
 * moves the balance. Anything the client could assert about a purchase, an
 * attacker could assert too.
 *
 * The RevenueCat user id is deliberately our own `user_id`, so the webhook's
 * `app_user_id` lands on the right account without any extra mapping.
 *
 * The keys below are the PUBLIC SDK keys (`appl_…` / `goog_…`), which are
 * meant to ship inside the app. The secret key (`sk_…`) belongs on the server
 * and must never appear in this file.
 */
import { Platform } from "react-native";

import Purchases, {
  LOG_LEVEL,
  PurchasesPackage,
} from "react-native-purchases";

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

function apiKey(): string | undefined {
  if (Platform.OS === "ios") return IOS_KEY;
  if (Platform.OS === "android") return ANDROID_KEY;
  return undefined;
}

/**
 * False when the store SDK cannot work here: the web build, or a build where
 * the keys were never set. Screens use this to hide the buy button instead of
 * showing one that throws.
 */
export function purchasesAvailable(): boolean {
  return !!apiKey();
}

let configured = false;
let currentUserId: string | null = null;

export async function configurePurchases(userId?: string | null): Promise<void> {
  const key = apiKey();

  if (!key) return;

  try {
    if (!configured) {
      if (process.env.NODE_ENV !== "production") {
        Purchases.setLogLevel(LOG_LEVEL.WARN);

        // RevenueCat reports "no products in your offerings" as an ERROR,
        // which React Native turns into a red "Console Error" overlay on
        // every paywall visit until the store products exist. It is a setup
        // reminder, not a crash — show it as a yellow warning instead.
        Purchases.setLogHandler((level, message) => {
          if (level === LOG_LEVEL.ERROR || level === LOG_LEVEL.WARN) {
            console.warn(`[RevenueCat] ${message}`);
          }
        });
      }

      Purchases.configure({
        apiKey: key,
        appUserID: userId || undefined,
      });

      configured = true;
      currentUserId = userId || null;

      return;
    }

    // Already running: switch identity only when it actually changed, since
    // logIn() is a network call.
    if (userId && userId !== currentUserId) {
      await Purchases.logIn(userId);
      currentUserId = userId;
    }
  } catch (e) {
    // A broken store connection must never block sign-in.
    console.warn("[Purchases] configure failed", e);
  }
}

export async function logOutPurchases(): Promise<void> {
  if (!configured) return;

  try {
    await Purchases.logOut();
  } catch {
    // Logging out of an anonymous session throws; harmless.
  }

  currentUserId = null;
}

/** Packages from the current offering, keyed by store product id. */
export async function getPackages(): Promise<PurchasesPackage[]> {
  if (!purchasesAvailable()) return [];

  try {
    const offerings = await Purchases.getOfferings();

    return offerings.current?.availablePackages ?? [];
  } catch (e) {
    console.warn("[Purchases] getOfferings failed", e);
    return [];
  }
}

export type PurchaseOutcome =
  | { status: "purchased" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function buyPackage(
  pack: PurchasesPackage,
): Promise<PurchaseOutcome> {
  try {
    await Purchases.purchasePackage(pack);

    return { status: "purchased" };
  } catch (e: any) {
    // The SDK reports a user backing out as an error; it is not one.
    if (e?.userCancelled) {
      return { status: "cancelled" };
    }

    return {
      status: "error",
      message:
        e?.underlyingErrorMessage || e?.message || "The purchase failed.",
    };
  }
}

export async function restoreStorePurchases(): Promise<boolean> {
  if (!purchasesAvailable()) return false;

  try {
    await Purchases.restorePurchases();
    return true;
  } catch (e) {
    console.warn("[Purchases] restore failed", e);
    return false;
  }
}

/**
 * Match a store package to one of our FX packs.
 *
 * Product ids may be written `fx_popular`, `prankfx_fx_popular` or plain
 * `popular`, and Google appends `:base-plan` — the backend normalises the
 * same way, so the two sides agree however the console is filled in.
 */
export function packIdForProduct(productId: string): string {
  return normalizeProductId(productId);
}

/**
 * Strip the naming variations a product id picks up on its way through two
 * consoles, so `prankfx_weekly:weekly-base-plan` and `weekly` are the same
 * thing. The backend normalises identically — that agreement is what makes a
 * payment match a plan instead of matching nothing.
 */
export function normalizeProductId(productId: string): string {
  let candidate = productId.trim().toLowerCase().split(":", 1)[0];

  for (const prefix of ["prankfx_", "fx_", "prankfx.", "fx."]) {
    if (candidate.startsWith(prefix)) {
      candidate = candidate.slice(prefix.length);
    }
  }

  return candidate;
}

/**
 * The store package for one of our subscription plans.
 *
 * Matched on the product id rather than RevenueCat's `packageType`, because
 * the package type is just the slot the offering was filled into and says
 * nothing about which of our plans it holds.
 */
export function findPlanPackage(
  packages: PurchasesPackage[],
  planId: string,
): PurchasesPackage | undefined {
  return packages.find(
    (item) => normalizeProductId(item.product.identifier) === planId,
  );
}

/**
 * How the store describes the billing period, e.g. "P1W".
 *
 * Shown on the paywall because both stores require the length and the price
 * of a subscription to be visible on the screen that sells it. An omission
 * there is a review rejection, not a detail.
 */
export function subscriptionPeriod(pack: PurchasesPackage): string {
  const product: any = pack.product;

  return (
    product?.subscriptionPeriod ||
    product?.defaultOption?.billingPeriod?.iso8601 ||
    ""
  );
}
