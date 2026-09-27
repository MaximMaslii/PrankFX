/**
 * Over-the-air updates (EAS Update).
 *
 * After the app is in the stores, every change to JS/TS code, screens, texts,
 * translations and images ships with one command (see OTA_UPDATES.md):
 *
 *     npm run update:production -- "what changed"
 *
 * How it reaches users:
 *   1. On every launch expo-updates checks for a newer bundle (app.json →
 *      updates.checkAutomatically = ON_LOAD) and starts downloading it.
 *   2. This hook ALSO checks whenever the app comes back to the foreground,
 *      so people who never fully close the app still get it.
 *   3. A downloaded update is applied on the next cold start — never in the
 *      middle of a generation or a paywall.
 *
 * Native changes (a new native module, a new permission, an Expo SDK bump)
 * cannot travel this way; those need a store build with a higher "version"
 * in app.json (runtimeVersion follows it).
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Updates from "expo-updates";

/** Do not ask the update server more than once per this interval. */
const MIN_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function useOtaUpdates() {
  const lastCheck = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    // Development builds, Expo Go and the web preview have no update channel.
    if (__DEV__ || !Updates.isEnabled) return;

    const check = async () => {
      const now = Date.now();
      if (busy.current || now - lastCheck.current < MIN_CHECK_INTERVAL_MS) return;

      busy.current = true;
      lastCheck.current = now;

      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          // Applied automatically on the next cold start.
        }
      } catch {
        // Offline or the update server is unreachable — try again later.
      } finally {
        busy.current = false;
      }
    };

    check();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });

    return () => sub.remove();
  }, []);
}

/** Shown in Settings so support can tell which bundle a user is running. */
export function currentUpdateLabel(): string {
  try {
    if (!Updates.isEnabled || !Updates.updateId) return "embedded";
    return `${Updates.channel || "?"} · ${Updates.updateId.slice(0, 8)}`;
  } catch {
    return "embedded";
  }
}
