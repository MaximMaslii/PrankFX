/**
 * Sign in with Apple.
 *
 * App Store review guideline 4.8 makes this mandatory as long as the app also
 * offers Google sign-in, so on iOS it is not optional decoration.
 *
 * iOS uses Apple's native sheet; Android opens Apple's web sign-in in a
 * browser tab (needs APPLE_SERVICE_ID on the server).
 *
 * Two Apple quirks the rest of the app has to live with:
 *   • the display name is handed over on the FIRST sign-in only, and never
 *     again — so it is forwarded to the server right here, at that moment;
 *   • the email may be a `@privaterelay.appleid.com` address, which is a
 *     real, deliverable address, just not the person's own.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { API_BASE, AppConfigAPI } from "@/src/api/client";

/** Where the backend callback sends the browser back to (app.json "scheme"). */
const APPLE_RETURN_URL = "prankfx://apple-callback";

/**
 * Android has no native Apple sheet, so it uses Apple's web sign-in in a
 * browser tab (backend: app/routers/apple_web.py). The server says whether
 * that is configured; until it is, the button stays hidden on Android.
 */
async function androidAppleSignIn(): Promise<AppleAuthOutcome> {
  const state = Crypto.randomUUID();

  const result = await WebBrowser.openAuthSessionAsync(
    `${API_BASE}/auth/apple/start?state=${encodeURIComponent(state)}`,
    APPLE_RETURN_URL,
  );

  if (result.type !== "success" || !result.url) {
    return { status: "cancelled" };
  }

  const params = (Linking.parse(result.url).queryParams || {}) as Record<string, string | undefined>;

  if (params.error) {
    if (params.error === "user_cancelled_authorize") return { status: "cancelled" };
    return { status: "error", message: `Apple: ${params.error}` };
  }

  // The state we sent must come back unchanged — otherwise this is not the
  // answer to our own request.
  if (params.state !== state || !params.id_token) {
    return { status: "error", message: "Sign in with Apple could not be verified. Try again." };
  }

  return {
    status: "success",
    identityToken: String(params.id_token),
    fullName: params.name ? String(params.name) : undefined,
  };
}

export type AppleAuthOutcome =
  | { status: "success"; identityToken: string; fullName?: string }
  | { status: "cancelled" }
  | { status: "error"; message: string; code?: string };

export function useAppleAuth() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  const inFlight = useRef(false);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS === "android") {
      // Always shown on Android. Whether the server can actually complete
      // the web flow is checked on tap (see `configured` below), so the
      // button is there from day one and starts working the moment
      // APPLE_SERVICE_ID is set — no app update.
      setAvailable(true);

      return () => {
        mounted = false;
      };
    }

    if (Platform.OS !== "ios") {
      return () => {
        mounted = false;
      };
    }

    AppleAuthentication.isAvailableAsync()
      .then((value) => {
        if (mounted) setAvailable(value);
      })
      .catch(() => {
        if (mounted) setAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (): Promise<AppleAuthOutcome> => {
    if (inFlight.current) {
      return { status: "cancelled" };
    }

    if (!available) {
      return {
        status: "error",
        message: "Sign in with Apple is not available on this device.",
      };
    }

    inFlight.current = true;
    setBusy(true);

    if (Platform.OS === "android") {
      try {
        const config = await AppConfigAPI.get().catch(() => null);

        if (config && !config.apple_web_sign_in) {
          return { status: "error", code: "not_configured", message: "not_configured" };
        }

        return await androidAppleSignIn();
      } catch (e: any) {
        return { status: "error", message: e?.message || "Sign in with Apple failed." };
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return {
          status: "error",
          message: "Apple did not return an identity token.",
        };
      }

      const fullName = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        status: "success",
        identityToken: credential.identityToken,
        fullName: fullName || undefined,
      };
    } catch (e: any) {
      // Backing out of the sheet arrives as an error code, not a result.
      if (e?.code === "ERR_REQUEST_CANCELED" || e?.code === "ERR_CANCELED") {
        return { status: "cancelled" };
      }

      return {
        status: "error",
        message: e?.message || "Sign in with Apple failed.",
        code: e?.code,
      };
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [available]);

  return { signIn, available, busy };
}
