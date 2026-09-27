/**
 * Native Google Sign-In for PrankFX.
 *
 * Android uses Google Credential Manager through
 * react-native-nitro-google-signin.
 *
 * Every non-success outcome used to collapse into `cancelled`, so a rejected
 * sign-in (wrong SHA-1, no Google account on the device, Play Services out of
 * date) looked exactly like the user tapping "back": the button stopped
 * spinning and nothing else happened. Each case is now told apart and comes
 * back with a message that says what to fix.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from "react-native-nitro-google-signin";

import { GOOGLE_WEB_CLIENT_ID } from "./googleConfig";

export type GoogleAuthOutcome =
  | { status: "success"; idToken: string }
  | { status: "cancelled" }
  | { status: "error"; message: string; code?: string };

/**
 * Turns a native error into something a user can act on.
 *
 * `DEVELOPER_ERROR` is the one that matters in practice: it means the build
 * that is running was not the one registered in Google Cloud Console — a
 * different signing key (SHA-1), a different package name, or an Android
 * client id passed where the Web client id belongs.
 */
function describeError(e: any): GoogleAuthOutcome {
  if (isErrorWithCode(e)) {
    switch (e.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return { status: "cancelled" };

      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return {
          status: "error",
          code: e.code,
          message:
            "Google Play services are missing or out of date on this device. " +
            "Update Google Play services and try again.",
        };

      case statusCodes.DEVELOPER_ERROR:
        return {
          status: "error",
          code: e.code,
          message:
            "Google rejected this build. In Google Cloud Console the Android " +
            "OAuth client must have package com.prankfx.app and the SHA-1 of " +
            "the key this build is signed with (gradlew signingReport).",
        };

      case statusCodes.ONE_TAP_START_FAILED:
        return {
          status: "error",
          code: e.code,
          message:
            "Google could not start the sign-in dialog. Check that a Google " +
            "account is added on the device and that it has a network connection.",
        };

      case statusCodes.IN_PROGRESS:
        return {
          status: "error",
          code: e.code,
          message: "A Google sign-in is already in progress.",
        };

      default:
        return {
          status: "error",
          code: e.code,
          message: e.message || "Google sign-in failed.",
        };
    }
  }

  return {
    status: "error",
    message: e?.message || e?.userMessage || "Google sign-in failed.",
  };
}

export function useGoogleAuth() {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const inFlight = useRef(false);

  /** Why configure() failed, so signIn can report it instead of a blank "not ready". */
  const configureError = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    try {
      // Credential Manager signs the ID token for the WEB client, which is why
      // the backend's GOOGLE_CLIENT_IDS must list that id as an audience.
      GoogleOneTapSignIn.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ["openid", "profile", "email"],
      });

      configureError.current = null;

      if (mounted) {
        setReady(true);
      }
    } catch (e: any) {
      const message = e?.message || String(e);

      console.error("[Google] configure failed:", message);

      configureError.current = message;

      if (mounted) {
        setReady(false);
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (): Promise<GoogleAuthOutcome> => {
    if (inFlight.current) {
      return { status: "cancelled" };
    }

    if (Platform.OS !== "android") {
      return {
        status: "error",
        message: "Native Google Sign-In is currently configured for Android.",
      };
    }

    if (!ready) {
      return {
        status: "error",
        message: configureError.current
          ? `Google Sign-In could not start: ${configureError.current}`
          : "Google Sign-In is still initializing. Please try again in a moment.",
      };
    }

    inFlight.current = true;
    setBusy(true);

    try {
      await GoogleOneTapSignIn.checkPlayServices();

      console.log("[Google] Opening explicit sign-in");

      // The explicit "Sign in with Google" dialog lists every account on the
      // device, so "use another account" works the same as an account that has
      // signed in before.
      let response = await GoogleOneTapSignIn.presentExplicitSignIn();

      // No credential at all — try the picker that can also add an account.
      if (isNoSavedCredentialFoundResponse(response)) {
        console.log("[Google] No saved credential, opening account picker");

        response = await GoogleOneTapSignIn.createAccount();
      }

      if (isSuccessResponse(response)) {
        const { idToken, user } = response.data;

        console.log(
          "[Google] Native sign-in success:",
          user?.email ?? "unknown",
        );

        if (!idToken) {
          return {
            status: "error",
            message: "Google did not return an ID token.",
          };
        }

        return { status: "success", idToken };
      }

      // The user dismissed the dialog — that is normal, stay silent.
      if (isCancelledResponse(response)) {
        console.log("[Google] Sign-in cancelled by the user");
        return { status: "cancelled" };
      }

      if (isNoSavedCredentialFoundResponse(response)) {
        return {
          status: "error",
          message:
            "No Google account is available on this device. Add one in " +
            "Settings → Accounts → Add account → Google, then try again.",
        };
      }

      console.log(
        "[Google] Sign-in did not succeed:",
        JSON.stringify(response),
      );

      return {
        status: "error",
        message: "Google sign-in did not complete. Please try again.",
      };
    } catch (e: any) {
      const outcome = describeError(e);

      if (outcome.status === "error") {
        console.error("[Google] Native sign-in error:", outcome.code, outcome.message);
      }

      return outcome;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [ready]);

  return {
    signIn,
    busy,
    ready,
    redirectUri: undefined,
  };
}
