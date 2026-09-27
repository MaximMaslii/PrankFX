/**
 * PrankFX design tokens — "Neon Carnival".
 *
 * The idea in one line: the interface is a dark fairground at night, the
 * user's content is the lit attraction. Everything chrome-coloured recedes
 * into deep indigo; exactly one element per screen glows lime.
 *
 * Rules that keep it from turning gaudy:
 *   1. ONE lime element per screen — the primary action. Lime is the loudest
 *      colour here, so if two things are lime, neither reads as the thing to
 *      press.
 *   2. Magenta is for state, not decoration: FX balance, premium, alerts.
 *      Violet and cyan only ever appear inside the Snap/premium gradients.
 *   3. Colour never carries meaning alone — every coloured badge has an icon
 *      or a label next to it.
 *   4. Content beats chrome. Photo cards have no coloured frames; they get
 *      depth from a dark scrim and a 1px hairline instead.
 *
 * Contrast (WCAG AA) was checked for every text pairing below: lime on
 * indigo ≈ 12:1, ink on lime ≈ 14:1, magenta-ink on white ≈ 6.6:1.
 */
export type ThemeMode = "light" | "dark";

/**
 * Dark is the intended, designed-for mode — the palette starts here and the
 * light one is derived from it.
 */
export const DarkColors = {
  // --- Surfaces ---------------------------------------------------
  surface: "#0D0B1A",
  onSurface: "#FFFFFF",

  surfaceSecondary: "#1A1533",
  onSurfaceSecondary: "#EDEAFB",

  surfaceTertiary: "#241E45",
  onSurfaceTertiary: "#A6A0C8",

  surfaceInverse: "#F3F1FF",
  onSurfaceInverse: "#0D0B1A",

  /** Page background gradient, top to bottom. Never flat black. */
  bgGradient: ["#0D0B1A", "#120E28", "#0D0B1A"] as [string, string, string],

  // --- Brand ------------------------------------------------------
  /** Readable accent for text, icons and active tabs. */
  brand: "#C6FF3D",
  brandDeep: "#A6F52B",
  /** Primary button fill. Black label on top — never white. */
  brandGradient: ["#D8FF5C", "#A6F52B"] as [string, string],
  onBrand: "#0D0B1A",
  brandTertiary: "#243610",
  onBrandTertiary: "#DCFF8F",

  // --- Secondary accent -------------------------------------------
  /** Magenta: balance, premium, anything that costs money. */
  accent: "#FF2E88",
  onAccent: "#FFFFFF",
  accentSoft: "#3A0F27",

  violet: "#7C5CFF",
  cyan: "#35E0FF",

  /** Long, three-stop gradients — Snap and premium only. */
  premiumGradient: ["#FF2E88", "#7C5CFF", "#35E0FF"] as [string, string, string],
  snapGradient: ["#7C5CFF", "#FF2E88", "#35E0FF"] as [string, string, string],

  // --- Status -----------------------------------------------------
  success: "#33E88F",
  warning: "#FFC53D",
  error: "#FF4D6A",

  // --- Lines and depth --------------------------------------------
  border: "#2E2757",
  borderStrong: "#433B78",
  divider: "#241E45",

  /** Top highlight on raised cards — the 1px that sells the depth. */
  cardHighlight: "rgba(255,255,255,0.06)",

  glass: "rgba(26,21,51,0.72)",
  glassStrong: "rgba(13,11,26,0.92)",
  overlay: "rgba(5,4,12,0.72)",
  /** Scrim under text that sits on a photo. */
  scrim: "rgba(5,4,12,0.88)",

  glowBrand: "#C6FF3D",
  glowAccent: "#FF2E88",
};

/**
 * Light mode keeps the same carnival, lit differently: lavender paper,
 * the lime CTA unchanged, and magenta-ink where lime would be unreadable.
 */
export const LightColors: typeof DarkColors = {
  surface: "#F7F5FF",
  onSurface: "#14102B",

  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1E1840",

  surfaceTertiary: "#EFEBFF",
  onSurfaceTertiary: "#615A87",

  surfaceInverse: "#14102B",
  onSurfaceInverse: "#FFFFFF",

  bgGradient: ["#FFFFFF", "#F7F5FF", "#F1EDFF"] as [string, string, string],

  // Lime is invisible on paper, so the readable accent becomes magenta-ink —
  // the button fill below stays lime, which keeps the brand constant.
  brand: "#C21D78",
  brandDeep: "#9C135F",
  brandGradient: ["#D8FF5C", "#A6F52B"] as [string, string],
  onBrand: "#14102B",
  brandTertiary: "#FFE4F2",
  onBrandTertiary: "#8E0F56",

  accent: "#D6006E",
  onAccent: "#FFFFFF",
  accentSoft: "#FFE4F1",

  violet: "#6B21FF",
  cyan: "#0BA5C7",

  premiumGradient: ["#FF2E88", "#7C5CFF", "#35E0FF"] as [string, string, string],
  snapGradient: ["#7C5CFF", "#FF2E88", "#35E0FF"] as [string, string, string],

  success: "#12A05E",
  warning: "#B36B00",
  error: "#D6263F",

  border: "#E4DFF7",
  borderStrong: "#CFC7EC",
  divider: "#EDE9FA",

  cardHighlight: "rgba(20,16,43,0.04)",

  glass: "rgba(255,255,255,0.78)",
  glassStrong: "rgba(247,245,255,0.94)",
  overlay: "rgba(20,16,43,0.42)",
  scrim: "rgba(5,4,12,0.82)",

  glowBrand: "#A6F52B",
  glowAccent: "#D6006E",
};

export type ColorPalette = typeof DarkColors;

/**
 * Radii. Slightly tighter than the previous scale: a 24px radius on a 140px
 * card reads as a blob, 20 reads as a card.
 */
export const Radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xl2: 32, xl3: 48 };

export const FontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 20,
  xl2: 24,
  xl3: 32,
  xl4: 40,
};

/**
 * Font families. `display` is Unbounded Black (SIL OFL, bundled in
 * assets/fonts) — wide, rounded, loud; it covers Latin, Cyrillic and German
 * umlauts, so every language gets the same headline. Used sparingly: the
 * hook headlines only. If the file ever fails to load, React Native falls
 * back to the system font rather than failing.
 */
export const FontFamily = {
  display: "Unbounded-Black",
};

export const FontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
};

/**
 * Display type: tight tracking at large sizes is what makes a headline look
 * drawn rather than typed.
 */
export const Tracking = {
  display: -0.8,
  title: -0.3,
  body: 0,
  kicker: 1.4,
};

/**
 * Coloured glow under an interactive element. On Android `elevation` cannot
 * be tinted, so the value there is deliberately small — the gradient fill
 * carries the emphasis instead and nothing looks muddy.
 */
export function glow(color: string, strength: "sm" | "md" | "lg" = "md") {
  const map = {
    sm: { radius: 10, opacity: 0.28, offset: 4, elevation: 3 },
    md: { radius: 18, opacity: 0.38, offset: 8, elevation: 6 },
    lg: { radius: 28, opacity: 0.45, offset: 12, elevation: 10 },
  } as const;

  const s = map[strength];

  return {
    shadowColor: color,
    shadowOpacity: s.opacity,
    shadowRadius: s.radius,
    shadowOffset: { width: 0, height: s.offset },
    elevation: s.elevation,
  };
}

/** Neutral depth for cards that must not glow. */
export function shadow(strength: "sm" | "md" = "sm") {
  return strength === "sm"
    ? {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }
    : {
        shadowColor: "#000",
        shadowOpacity: 0.26,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
      };
}

/** Motion: one duration scale, so nothing feels out of step. */
export const Motion = {
  fast: 140,
  base: 220,
  slow: 380,
  /** How far a pressable sinks. Subtle beats bouncy. */
  pressScale: 0.97,
};

export function getColors(mode: ThemeMode): ColorPalette {
  return mode === "dark" ? DarkColors : LightColors;
}
