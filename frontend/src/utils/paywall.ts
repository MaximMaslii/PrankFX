/**
 * When to show the paywall.
 *
 * The rule the app follows: one free result first, the offer second. Showing
 * the price before anything has been created asks someone to pay for a
 * promise; showing it right after their first result asks them to pay for
 * something they have just watched work.
 *
 * And then it gets out of the way. A paywall that reappears after every
 * single result is not persuasion, it is friction — people stop opening the
 * app rather than start paying. Hence the cooldown: the automatic offer
 * happens at most once a day. Tapping something that genuinely needs FX
 * bypasses it, because that is the user asking, not us interrupting.
 */
import { storage } from "@/src/utils/storage";

const LAST_OFFERED_KEY = "prankfx.paywall.lastOffered";

/** Just under a day, so a daily user does not drift past it. */
const COOLDOWN_MS = 20 * 60 * 60 * 1000;

/** Let the result land before covering it. */
export const PAYWALL_DELAY_MS = 2200;

export async function shouldOfferPaywall(): Promise<boolean> {
  const last = await storage.getItem<number>(LAST_OFFERED_KEY, 0);

  if (!last) return true;

  return Date.now() - last > COOLDOWN_MS;
}

export async function markPaywallOffered(): Promise<void> {
  await storage.setItem(LAST_OFFERED_KEY, Date.now());
}
