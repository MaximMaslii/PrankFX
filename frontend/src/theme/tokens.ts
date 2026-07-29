/**
 * Design tokens for PrankFX — Light and Dark palettes.
 * Sourced from /app/design_guidelines.json.
 */
export type ThemeMode = "light" | "dark";

export const LightColors = {
  surface: "#F9F9FB",
  onSurface: "#111111",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1A1A1A",
  surfaceTertiary: "#F0F0F5",
  onSurfaceTertiary: "#6B6B70",
  surfaceInverse: "#0C0C0E",
  onSurfaceInverse: "#FFFFFF",
  brand: "#FF3B30",
  brandDeep: "#B31E15",
  brandGradient: ["#FF3B30", "#FF6B4A"] as [string, string],
  premiumGradient: ["#FFB800", "#FF6B4A", "#FF3B30"] as [string, string, string],
  onBrand: "#FFFFFF",
  brandTertiary: "#FFD8D6",
  onBrandTertiary: "#990000",
  success: "#34C759",
  warning: "#FF9F0A",
  error: "#FF3B30",
  border: "#E5E5EA",
  borderStrong: "#C7C7CC",
  divider: "#E5E5EA",
  glass: "rgba(255,255,255,0.72)",
  glassStrong: "rgba(255,255,255,0.86)",
  overlay: "rgba(0,0,0,0.35)",
};

export const DarkColors = {
  surface: "#000000",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1C1C1E",
  onSurfaceSecondary: "#F2F2F7",
  surfaceTertiary: "#2C2C2E",
  onSurfaceTertiary: "#AEAEB2",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#000000",
  brand: "#FF453A",
  brandDeep: "#FF3B30",
  brandGradient: ["#FF453A", "#FF6B4A"] as [string, string],
  premiumGradient: ["#FFB800", "#FF6B4A", "#FF3B30"] as [string, string, string],
  onBrand: "#FFFFFF",
  brandTertiary: "#3B1414",
  onBrandTertiary: "#FFD8D6",
  success: "#32D74B",
  warning: "#FF9F0A",
  error: "#FF453A",
  border: "#38383A",
  borderStrong: "#48484A",
  divider: "#38383A",
  glass: "rgba(28,28,30,0.72)",
  glassStrong: "rgba(28,28,30,0.88)",
  overlay: "rgba(0,0,0,0.55)",
};

export type ColorPalette = typeof LightColors;

export const Radius = { sm: 8, md: 16, lg: 24, xl: 32, pill: 999 };
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xl2: 32, xl3: 48 };
export const FontSize = { xs: 11, sm: 12, base: 14, md: 15, lg: 16, xl: 20, xl2: 24, xl3: 32, xl4: 40 };
export const FontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
};

export function getColors(mode: ThemeMode): ColorPalette {
  return mode === "dark" ? DarkColors : LightColors;
}
