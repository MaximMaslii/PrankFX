import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { storage } from "@/src/utils/storage";
import { ColorPalette, ThemeMode, getColors } from "./tokens";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ColorPalette;
  preference: "system" | "light" | "dark";
  setPreference: (p: "system" | "light" | "dark") => Promise<void>;
};

const KEY = "prankfx.theme.preference";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<"system" | "light" | "dark">("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(KEY, "system");
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
      setReady(true);
    })();
  }, []);

  const mode: ThemeMode = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  const setPreference = useCallback(async (p: "system" | "light" | "dark") => {
    setPreferenceState(p);
    await storage.setItem(KEY, p);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    colors: getColors(mode),
    preference,
    setPreference,
  }), [mode, preference, setPreference]);

  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
