/**
 * Native Google Sign-In for PrankFX.
 *
 * Android uses Google Credential Manager through
 * react-native-nitro-google-signin.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  GoogleOneTapSignIn,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";

import {
  GOOGLE_WEB_CLIENT_ID,
} from "./googleConfig";

export type GoogleAuthOutcome =
  | { status: "success"; idToken: string }
  | { status: "cancelled" }
  | { status: "error"; message: string; code?: string };

export function useGoogleAuth() {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const inFlight = useRef(false);

  useEffect(() => {
    let mounted = true;

    try {
      GoogleOneTapSignIn.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ["openid", "profile", "email"],
      });

      if (mounted) {
        setReady(true);
      }
    } catch (e: any) {
      console.error(
        "[Google] configure failed:",
        e?.message || e,
      );

      if (mounted) {
        setReady(false);
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(
    async (): Promise<GoogleAuthOutcome> => {
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
          message:
            "Google Sign-In is still initializing. Please try again in a moment.",
        };
      }

      inFlight.current = true;
      setBusy(true);

      try {
        await GoogleOneTapSignIn.checkPlayServices();

        console.log("[Google] Starting native sign-in");

        await GoogleOneTapSignIn.checkPlayServices();

        console.log("[Google] Opening explicit sign-in");

        const response =
          await GoogleOneTapSignIn.presentExplicitSignIn();

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

          return {
            status: "success",
            idToken,
          };
        }

        console.log(
          "[Google] Sign-in did not succeed:",
          JSON.stringify(response),
        );

        return {
          status: "cancelled",
        };
      } catch (e: any) {
        const message =
          e?.message ||
          e?.userMessage ||
          "Google sign-in failed.";

        console.error(
          "[Google] Native sign-in error:",
          message,
          e,
        );

        return {
          status: "error",
          message,
          code: e?.code,
        };
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [ready],
  );

  return {
    signIn,
    busy,
    ready,
    redirectUri: undefined,
  };
}