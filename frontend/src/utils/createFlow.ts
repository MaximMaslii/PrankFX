/**
 * Global in-memory store for the currently-selected image and effect during
 * the create-flow (Home / Effects → Processing → Result). We keep raw base64
 * in memory only (never in AsyncStorage) to avoid quota bloat.
 */
let sourceImage: { base64: string; mime: string } | null = null;
let pendingEffect: { effect_id: string; effect_name: string; category: string } | null = null;
let lastResult: {
  project_id: string;
  effect_id: string;
  effect_name: string;
  category: string;
  original_image: string;
  result_image: string;
  is_favorite: boolean;
  created_at: string;
} | null = null;

export const CreateFlow = {
  setSource(base64: string, mime = "image/jpeg") {
    sourceImage = { base64, mime };
  },
  getSource() { return sourceImage; },
  setEffect(e: { effect_id: string; effect_name: string; category: string } | null) {
    pendingEffect = e;
  },
  getEffect() { return pendingEffect; },
  setResult(r: NonNullable<typeof lastResult>) { lastResult = r; },
  getResult() { return lastResult; },
  clear() { sourceImage = null; pendingEffect = null; },
};
