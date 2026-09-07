/**
 * Google OAuth client IDs.
 *
 * Values come from EXPO_PUBLIC_* env vars so the same source tree can be
 * pointed at a different Google Cloud project without editing code.
 * The literals are the fallback (they match the current project).
 *
 * IMPORTANT (Android):
 *   The Android OAuth client in Google Cloud Console must be registered with
 *     - package name: com.prankfx.app
 *     - SHA-1 of the keystore that actually signs the build you install
 *   The redirect scheme below is the "reversed client id" of the ANDROID
 *   client and must also be present in AndroidManifest.xml.
 */

export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
  "917307607930-5mulp0qe4b55gvhrno6qbnvmh2a2e1sc.apps.googleusercontent.com";

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  "917307607930-u5kaei1ktf64c8f7h5r6rq7io6hv5gbr.apps.googleusercontent.com";

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  "917307607930-q5916sbm39ga8bctlvumir4h3jmp4c34.apps.googleusercontent.com";

/**
 * Reversed client id used as the native redirect scheme.
 * Derived from the Android client id so the two can never drift apart.
 */
export function reversedClientId(clientId: string): string {
  const guid = clientId.replace(".apps.googleusercontent.com", "");
  return `com.googleusercontent.apps.${guid}`;
}

export const GOOGLE_NATIVE_REDIRECT = "prankfx://oauthredirect";

export const GOOGLE_IOS_REDIRECT = `${reversedClientId(
  GOOGLE_IOS_CLIENT_ID,
)}:/oauthredirect`;
