/**
 * Presentation helpers for Snap effects, shared by the picker, the Home hero
 * and the "My videos" row so an effect looks the same everywhere.
 */
import type { SnapEffect, SnapInput } from "@/src/api/client";

/**
 * Each effect gets its own two-stop gradient that hints at what it does —
 * chrome for liquid metal, a violet-cyan rift for the portal. Text on top is
 * always white over a dark bottom scrim, so contrast never depends on these.
 */
const GRADIENTS: Record<string, [string, string]> = {
  snap_fire: ["#FF8A00", "#FF2E63"],
  snap_liquid_metal: ["#9AA7BD", "#2E3A52"],
  snap_exit_photo: ["#35E0FF", "#5B3CFF"],
  snap_origami: ["#FF7EB3", "#8E2DE2"],
  snap_eraser: ["#FF6F91", "#C44569"],
  snap_toy_table: ["#F7971E", "#D9376E"],
  snap_antigravity: ["#4776E6", "#8E54E9"],
  snap_portal: ["#7C5CFF", "#00B4DB"],
  snap_pixel_decay: ["#11998E", "#1E3C72"],
};

const FALLBACK: [string, string] = ["#7C5CFF", "#FF2E88"];

export function snapGradientFor(effectId: string): [string, string] {
  return GRADIENTS[effectId] || FALLBACK;
}

/** Older servers did not send `input`; every effect they knew was recorded. */
export function snapInput(effect: Pick<SnapEffect, "input">): SnapInput {
  return effect.input === "photo" ? "photo" : "video";
}

/** Emoji for an effect id when only the id is known (e.g. a history row). */
const EMOJI: Record<string, string> = {
  snap_fire: "🔥",
  snap_liquid_metal: "🪞",
  snap_exit_photo: "🖼️",
  snap_origami: "🕊️",
  snap_eraser: "✏️",
  snap_toy_table: "🧸",
  snap_antigravity: "🪐",
  snap_portal: "🌀",
  snap_pixel_decay: "🧊",
  snap_bruise: "🥊",
  snap_zombie: "🧟",
};

export function snapEmojiFor(effectId: string): string {
  return EMOJI[effectId] || "✨";
}

/** The photo effects, in the order the Home hero shows them. */
export const SNAP_HERO_EFFECTS = [
  "snap_fire",
  "snap_liquid_metal",
  "snap_exit_photo",
  "snap_portal",
  "snap_origami",
  "snap_toy_table",
  "snap_pixel_decay",
  "snap_antigravity",
  "snap_eraser",
];

type CopyMap = Partial<Record<"en" | "ru" | "de", string>> | undefined;

/**
 * Title or tagline of an effect in the current language.
 *
 * Order: the server's copy (so new or renamed effects need no app update) →
 * the strings bundled in the app → the server's English → the raw fallback.
 */
export function snapCopy(
  t: (key: any) => string,
  lang: "en" | "ru" | "de",
  effectId: string,
  kind: "title" | "tagline",
  server?: CopyMap,
  fallback = "",
): string {
  if (server?.[lang]) return server[lang] as string;

  const key = kind === "title" ? `snap_fx_${effectId}` : `snap_tag_${effectId}`;
  const bundled = t(key);
  if (bundled && bundled !== key) return bundled;

  return server?.en || fallback;
}
