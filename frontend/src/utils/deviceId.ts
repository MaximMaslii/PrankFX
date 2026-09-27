/**
 * The identifier a guest session is tied to.
 *
 * What it is: a random value this app generates on first launch and keeps in
 * the device keychain. What it is NOT: a fingerprint. It says nothing about
 * the phone or the person, it is not derived from any hardware id, and it
 * never leaves this app. Its whole job is to make "you already have a guest
 * account here" answerable, so that reopening the app does not hand out the
 * free FX again.
 *
 * It lives in secure storage next to the auth token rather than in
 * AsyncStorage, because the two have to survive and be cleared together — a
 * device id that outlived a wiped session would resurrect an account the user
 * thought they had left.
 */
import * as Crypto from "expo-crypto";

import { storage } from "@/src/utils/storage";

export const DEVICE_ID_KEY = "prankfx.device.id";

/** Cached for the lifetime of the process: this is read on every cold start. */
let cached: string | null = null;

function randomId(): string {
  try {
    // Available since expo-crypto 12.7 and backed by the platform CSPRNG.
    const uuid = (Crypto as any).randomUUID?.();

    if (typeof uuid === "string" && uuid.length >= 16) {
      return uuid;
    }
  } catch {
    // Falls through to the byte-based path below.
  }

  try {
    const bytes = Crypto.getRandomBytes(16);

    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Last resort. Weaker, but a guest id only has to be unique, not secret:
    // it grants nothing on its own, and the server issues the actual session
    // token. Refusing to start the app here would be the worse failure.
    return `fallback-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 12)}`;
  }
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  const stored = await storage.secureGet<string>(DEVICE_ID_KEY, "");

  if (stored && stored.length >= 8) {
    cached = stored;
    return stored;
  }

  const fresh = randomId();

  // A failed write is not fatal: the session token that comes back is stored
  // separately, so the guest stays signed in for this install either way. It
  // only means a future reinstall starts a new guest.
  await storage.secureSet(DEVICE_ID_KEY, fresh);

  cached = fresh;

  return fresh;
}

/**
 * Forget the guest identity.
 *
 * Called on sign-out, so that signing out of a real account does not drop the
 * user back into the guest session that account grew out of.
 */
export async function clearDeviceId(): Promise<void> {
  cached = null;
  await storage.secureRemove(DEVICE_ID_KEY);
}
