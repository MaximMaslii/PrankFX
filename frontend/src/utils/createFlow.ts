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

/**
 * Snap flow (record → generate → loop). Kept separate from the photo flow so
 * neither can clobber the other when a user backs out mid-way.
 */
let snapEffect: {
  effect_id: string;
  effect_name: string;
  /** Title in the user's language at the moment it was picked. */
  title?: string;
  emoji: string;
  age_restricted: boolean;
  /** "photo" = animate one picture (PixVerse), "video" = record 5 s (Lucy). */
  input: "photo" | "video";
} | null = null;
let snapVideoUri: string | null = null;
let snapPhoto: { base64: string; mime: string; uri: string } | null = null;
let snapJobId: string | null = null;

export const SnapFlow = {
  setEffect(e: NonNullable<typeof snapEffect> | null) { snapEffect = e; },
  getEffect() { return snapEffect; },
  setVideo(uri: string | null) { snapVideoUri = uri; },
  getVideo() { return snapVideoUri; },
  setPhoto(p: NonNullable<typeof snapPhoto> | null) { snapPhoto = p; },
  getPhoto() { return snapPhoto; },
  setJobId(id: string | null) { snapJobId = id; },
  getJobId() { return snapJobId; },
  clear() { snapEffect = null; snapVideoUri = null; snapPhoto = null; snapJobId = null; },
};

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
