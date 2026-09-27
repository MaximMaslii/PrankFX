/**
 * API client for the PrankFX backend.
 * All calls are typed and share a single bearer token
 * stored in secure storage.
 */

import { storage } from "@/src/utils/storage";

const RAW_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

console.log("[PrankFX] EXPO_PUBLIC_BACKEND_URL =", RAW_BASE_URL);

/**
 * The port uvicorn listens on
 * (`uvicorn app.main:app --host 0.0.0.0 --port 8000`).
 *
 * A LAN address written without it ("http://192.168.1.42") silently means
 * port 80, where nothing answers. Every call then dies as "Cannot reach the
 * server" — including /auth/google, which makes a working Google sign-in look
 * broken. Instead of failing on a missing colon, the port is filled in.
 */
const DEFAULT_BACKEND_PORT = "8000";

/** LAN IP, localhost or a .local name — a dev machine, not a public host. */
function isLocalHostname(host: string): boolean {
  return (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host === "localhost" ||
    host.endsWith(".local")
  );
}

/**
 * Without EXPO_PUBLIC_BACKEND_URL the old code built the string
 * "undefined/api" and every request failed with an opaque error. Fail loudly
 * and early instead, with a message that says exactly what to do.
 *
 * The value is also normalised, because the three usual ways of mistyping it
 * all surface as the same unhelpful network error: a missing scheme, a
 * trailing "/api" (which would give "/api/api/auth/google"), and a missing
 * port.
 */
function resolveBaseUrl(): string {
  if (!RAW_BASE_URL || RAW_BASE_URL === "undefined") {
    return "";
  }

  // Trailing slashes would produce "//api".
  let url = RAW_BASE_URL.trim().replace(/\/+$/, "");

  if (!url) {
    return "";
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }

  // "/api" is appended by API_BASE below; keeping it here would double it.
  url = url.replace(/\/api$/i, "");

  const parts = url.match(/^(https?):\/\/([^/:]+)(:(\d+))?$/i);

  if (parts && !parts[3] && isLocalHostname(parts[2])) {
    url = `${url}:${DEFAULT_BACKEND_PORT}`;

    console.warn(
      `[PrankFX] EXPO_PUBLIC_BACKEND_URL has no port — falling back to ${url}. ` +
        "Write the port explicitly in frontend/.env.",
    );
  }

  return url;
}

const BASE_URL = resolveBaseUrl();

export const API_BASE = `${BASE_URL}/api`;

/**
 * Origin of the backend without the /api suffix — the public pages
 * (/privacy, /terms, /support, /data-deletion) live there, so the in-app
 * links always point at the same deployment the app is talking to.
 */
export const SITE_BASE = BASE_URL;

console.log("[PrankFX] API base =", API_BASE);
export const TOKEN_KEY = "prankfx.auth.token";

/** How long a single request may take before it is treated as unreachable. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Uploading a video takes far longer than a JSON round-trip, so multipart
 * requests get their own, much longer ceiling.
 */
const UPLOAD_TIMEOUT_MS = 180_000;

/**
 * Marker asking `request` to drop the Content-Type header entirely, so
 * fetch can generate the multipart boundary itself.
 */
const MULTIPART_SENTINEL = "__multipart__";

export type ApiError = Error & {
  status?: number;
  data?: any;
  /** True when the request never reached the server. */
  isNetworkError?: boolean;
};


// =========================================================
// TYPES
// =========================================================

export type UserOut = {
  user_id: string;
  /** Empty for a guest — a guest account has no address of its own. */
  email: string;
  name?: string | null;
  picture?: string | null;
  provider: string;

  /**
   * True until the account gains a password, Google or Apple. A guest can do
   * everything except buy — see the paywall screen for why.
   */
  is_guest?: boolean;

  // Legacy subscription fields.
  is_premium: boolean;
  premium_tier?: string | null;

  /** End of the current paid period. Null when not subscribed. */
  premium_expires_at?: string | null;

  /**
   * True while the plan is set to charge again. With the date above this is
   * the difference between "renews on 5 Oct" and "ends on 5 Oct".
   */
  premium_auto_renew?: boolean;

  // Legacy free-credit fields.
  free_credits_used?: number;
  free_credits_total?: number;

  // Current PrankFX FX balance.
  fx_credits: number;

  created_at: string;
};


export type AuthResponse = {
  token: string;
  user: UserOut;
};


export type EffectItem = {
  id: string;
  name: string;
  emoji: string;
  premium_tier?: string;
};


export type CategoryItem = {
  id: string;
  name: string;
  emoji: string;
  premium_tier: string;
  effects: EffectItem[];
};


export type ProjectListItem = {
  project_id: string;
  effect_id: string;
  effect_name: string;
  category: string;
  thumbnail: string;
  is_favorite: boolean;
  created_at: string;
};


export type ProjectFull = {
  project_id: string;
  effect_id: string;
  effect_name: string;
  category: string;
  original_image: string;
  result_image: string;
  is_favorite: boolean;
  created_at: string;
};


// =========================================================
// SNAP TYPES
// =========================================================

export type SnapInput = "video" | "photo";

export type AppConfig = {
  min_version: string | null;
  latest_version: string | null;
  maintenance: boolean;
  maintenance_message: Partial<Record<"en" | "ru" | "de", string>>;
  store_url: { android: string | null; ios: string | null };
  snap_fx_cost: number;
  /** Android: show "Continue with Apple" (web flow configured on server). */
  apple_web_sign_in?: boolean;
};

/** Server-side switches for the installed app (see backend app_config.py). */
export const AppConfigAPI = {
  get: () => request<AppConfig>("/app/config", { method: "GET" }, false, 8000),
};

export type SnapEffect = {
  id: string;
  name: string;
  emoji: string;
  age_restricted: boolean;
  fx_cost: number;
  /** "lucy" = recorded clip edited by Decart, "pixverse" = animated photo. */
  engine?: "lucy" | "pixverse";
  /** What the app collects before the job starts. Older servers omit it. */
  input?: SnapInput;
  badge?: "hit" | "new" | null;
  /** Localised copy from the server; preferred over the bundled strings so
   *  new effects show proper names without an app update. */
  title?: Partial<Record<"en" | "ru" | "de", string>>;
  tagline?: Partial<Record<"en" | "ru" | "de", string>>;
  /** Listed as a teaser; the server refuses jobs for it. */
  coming_soon?: boolean;
};


export type SnapCatalog = {
  effects: SnapEffect[];

  /** The recorder metronome reads its timings from the server so the
   *  flash can never drift away from the cut the backend makes. */
  total_seconds: number;
  snap_at_seconds: number;
  return_hint_seconds: number;
  fx_cost: number;
};


export type SnapJobStatus = "queued" | "processing" | "completed" | "failed";


export type SnapJob = {
  job_id: string;
  effect_id: string;
  effect_name: string;
  input?: SnapInput;
  status: SnapJobStatus;
  stage: string;
  error?: string | null;
  fx_charged: number;
  created_at: string;
};


// =========================================================
// FX TYPES
// =========================================================

export type FXPack = {
  id: string;
  fx: number;
  price: number;
};


export type FXBalance = {
  fx_credits: number;
};


export type SubscriptionPlan = {
  id: string;
  product_id: string;
  fx: number;
  /** Fallback price only — the paywall shows the store's own, localised one. */
  price: number;
  period: string;
  period_days: number;
};


export type CreditsInfo = {
  is_premium: boolean;
  premium_tier: string | null;

  // Legacy fields.
  free_credits_used: number;
  free_credits_total: number;
  free_credits_remaining: number;

  // Current FX balance.
  fx_credits: number;
};


// =========================================================
// AUTH TOKEN
// =========================================================

export async function getToken(): Promise<string | null> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? token : null;
}


export async function setToken(token: string): Promise<boolean> {
  return await storage.secureSet(TOKEN_KEY, token);
}


export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}


// =========================================================
// REQUEST
// =========================================================

async function request<T = any>(
  path: string,
  opts: RequestInit = {},
  auth = true,
  timeoutMs?: number,
): Promise<T> {

  if (!BASE_URL) {
    const err = new Error(
      "EXPO_PUBLIC_BACKEND_URL is not set. Create frontend/.env with " +
        "EXPO_PUBLIC_BACKEND_URL=http://<your-ip>:8000 and restart Expo with `npx expo start -c`.",
    ) as ApiError;
    err.isNetworkError = true;
    throw err;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };

  // Multipart bodies must set their own Content-Type, boundary included.
  const isMultipart = headers["Content-Type"] === MULTIPART_SENTINEL;

  if (isMultipart) {
    delete headers["Content-Type"];
  }

  if (auth) {
    const token = await getToken();

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // fetch() on React Native has no default timeout, so a dead backend would
  // hang the UI forever (spinner that never stops).
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs ?? (isMultipart ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS),
  );

  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
      signal: controller.signal,
    });
  } catch (e: any) {
    const err = new Error(
      e?.name === "AbortError"
        ? "The server took too long to respond."
        : `Cannot reach the server at ${BASE_URL}. Check that the backend is running and that the phone is on the same network.`,
    ) as ApiError;

    err.isNetworkError = true;
    err.data = e;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let detail =
      (data && data.detail) ||
      res.statusText ||
      "Request failed";

    // FastAPI validation errors arrive as an array of objects; render one
    // readable line instead of dumping raw JSON into a toast.
    if (Array.isArray(detail)) {
      detail = detail
        .map((d: any) => d?.msg || JSON.stringify(d))
        .join(", ");
    }

    const err = new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    ) as ApiError;

    err.status = res.status;
    err.data = data;

    throw err;
  }

  return data as T;
}


// =========================================================
// AUTH API
// =========================================================

export const AuthAPI = {

  /**
   * Start (or resume) a session with no account.
   *
   * Idempotent for a given device id: the server returns the same account
   * every time, so this is safe to call on any launch that finds no session.
   */
  guest: (device_id: string) =>
    request<AuthResponse>(
      "/auth/guest",
      {
        method: "POST",
        body: JSON.stringify({ device_id }),
      },
      false,
    ),

  register: (
    email: string,
    password: string,
    name?: string,
  ) =>
    request<AuthResponse>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      },
      // Sends the guest token when there is one: the backend promotes that
      // account in place instead of creating a second one, so the FX and the
      // pictures made before signing up survive.
      true,
    ),

  login: (
    email: string,
    password: string,
  ) =>
    request<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      },
      true,
    ),

  googleLogin: (token: string) =>
    request<AuthResponse>(
      "/auth/google",
      {
        method: "POST",
        body: JSON.stringify({
          token,
        }),
      },
      true,
    ),

  /**
   * `full_name` is sent because Apple gives the display name to the client on
   * the first sign-in only — it is never inside the token, so the server has
   * no other way to learn it.
   */
  appleLogin: (token: string, full_name?: string) =>
    request<AuthResponse>(
      "/auth/apple",
      {
        method: "POST",
        body: JSON.stringify({
          token,
          full_name,
        }),
      },
      true,
    ),

  forgot: (email: string) =>
    request<{
      ok: boolean;
      message: string;
    }>(
      "/auth/forgot",
      {
        method: "POST",
        body: JSON.stringify({
          email,
        }),
      },
      false,
    ),


  me: () =>
    request<UserOut>("/auth/me"),

  logout: () =>
    request<{ ok: boolean }>(
      "/auth/logout",
      {
        method: "POST",
      },
    ),

  deleteAccount: () =>
    request<{ ok: boolean }>(
      "/auth/account",
      {
        method: "DELETE",
      },
    ),
};


// =========================================================
// EFFECTS API
// =========================================================

export const EffectsAPI = {

  catalog: () =>
    request<{
      categories: CategoryItem[];
    }>(
      "/effects",
      {
        method: "GET",
      },
      false,
    ),
};


// =========================================================
// GENERATE API
// =========================================================

export const GenAPI = {

  generate: (
    image_base64: string,
    effect_id: string,
    save_to_history = true,
  ) =>
    request<ProjectFull>(
      "/generate",
      {
        method: "POST",
        body: JSON.stringify({
          image_base64,
          effect_id,
          save_to_history,
        }),
      },
    ),
};


// =========================================================
// SNAP API
// =========================================================

export const SnapAPI = {

  catalog: () =>
    request<SnapCatalog>(
      "/snap/effects",
      {
        method: "GET",
      },
      false,
    ),


  /**
   * Upload a recording and start the job.
   *
   * Sent as multipart rather than base64: a 5-second clip is a few megabytes,
   * and base64 would inflate it by a third and hold the whole thing in JS
   * memory twice over.
   *
   * `Content-Type` is deliberately deleted — React Native's fetch has to set
   * it itself so the multipart boundary matches the body it builds.
   */
  createJob: async (videoUri: string, effectId: string) => {
    const form = new FormData();

    form.append("effect_id", effectId);
    form.append("video", {
      uri: videoUri,
      name: "snap.mp4",
      type: "video/mp4",
    } as any);

    return request<SnapJob>(
      "/snap/jobs",
      {
        method: "POST",
        body: form as any,
        headers: {
          "Content-Type": MULTIPART_SENTINEL,
        },
      },
    );
  },


  /**
   * Start a Snap from one photo (PixVerse). The photo is already base64 from
   * the picker, so it goes as JSON — same as /generate.
   */
  createPhotoJob: (imageBase64: string, effectId: string) =>
    request<SnapJob>(
      "/snap/photo-jobs",
      {
        method: "POST",
        body: JSON.stringify({
          effect_id: effectId,
          image_base64: imageBase64,
        }),
      },
      true,
      UPLOAD_TIMEOUT_MS,
    ),


  getJob: (jobId: string) =>
    request<SnapJob>(`/snap/jobs/${jobId}`),


  list: () =>
    request<{ items: SnapJob[] }>("/snap/jobs"),


  remove: (jobId: string) =>
    request<{ ok: boolean }>(
      `/snap/jobs/${jobId}`,
      {
        method: "DELETE",
      },
    ),


  /** Absolute URL of the finished clip. Needs the auth header — see snapAuthHeaders. */
  videoUrl: (jobId: string) => `${API_BASE}/snap/jobs/${jobId}/video`,


  /** Thumbnail of a finished clip. Needs the auth header as well. */
  posterUrl: (jobId: string) => `${API_BASE}/snap/jobs/${jobId}/poster`,


  /** Headers for downloading that URL with expo-file-system / expo-video. */
  authHeaders: async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};


// =========================================================
// PROJECTS API
// =========================================================

export const ProjectsAPI = {

  list: (
    opts: {
      favorites?: boolean;
      search?: string;
    } = {},
  ) => {

    const q = new URLSearchParams();

    if (opts.favorites) {
      q.set("favorites", "true");
    }

    if (opts.search) {
      q.set("search", opts.search);
    }

    const suffix = q.toString()
      ? `?${q.toString()}`
      : "";

    return request<{
      items: ProjectListItem[];
    }>(`/projects${suffix}`);
  },


  get: (id: string) =>
    request<ProjectFull>(
      `/projects/${id}`,
    ),


  setFavorite: (
    id: string,
    is_favorite: boolean,
  ) =>
    request<{
      ok: boolean;
      is_favorite: boolean;
    }>(
      `/projects/${id}/favorite`,
      {
        method: "PATCH",
        body: JSON.stringify({
          is_favorite,
        }),
      },
    ),


  remove: (id: string) =>
    request<{ ok: boolean }>(
      `/projects/${id}`,
      {
        method: "DELETE",
      },
    ),
};


// =========================================================
// PURCHASES
// =========================================================

export const PurchasesAPI = {

  /**
   * Ask the server to re-check what this account is entitled to.
   *
   * Called after the store SDK's own restore, because the store knows about
   * the receipt and only our backend knows about the account.
   */
  restore: () =>
    request<{
      is_premium: boolean;
      premium_tier: string | null;
      synced: boolean;
    }>(
      "/purchases/restore",
      {
        method: "POST",
      },
    ),
};


// =========================================================
// SUBSCRIPTION / FX API
// =========================================================

export const SubAPI = {

  // -------------------------------------------------------
  // Subscription status.
  //
  // There is no activate method. The endpoint it called granted premium
  // without any payment, so it was removed on the server too.
  // -------------------------------------------------------

  restore: () =>
    request<{
      is_premium: boolean;
      premium_tier: string | null;
    }>(
      "/subscription/restore",
      {
        method: "POST",
      },
    ),


  cancel: () =>
    request<{ ok: boolean }>(
      "/subscription/cancel",
      {
        method: "POST",
      },
    ),


  // -------------------------------------------------------
  // Current FX system.
  // -------------------------------------------------------

  credits: () =>
    request<CreditsInfo>(
      "/subscription/credits",
    ),


  fxBalance: () =>
    request<FXBalance>(
      "/subscription/fx/balance",
    ),


  fxPacks: () =>
    request<FXPack[]>(
      "/subscription/fx/packs",
    ),


  /** Subscription catalogue. Public — the paywall renders before sign-in. */
  plans: () =>
    request<SubscriptionPlan[]>(
      "/subscription/plans",
      { method: "GET" },
      false,
    ),


  /**
   * Dev-only top-up. The server answers 404 unless ALLOW_MOCK_PURCHASES
   * is set, so this throws in any real build — replace with StoreKit /
   * Play Billing before release.
   */
  mockFXPurchase: (packId: string) =>
    request<{
      ok: boolean;
      pack_id: string;
      fx_added: number;
      fx_credits: number;
    }>(
      `/subscription/fx/mock-purchase/${packId}`,
      {
        method: "POST",
      },
    ),
};