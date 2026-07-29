/**
 * API client for the PrankFX backend. All calls are typed and share a single
 * bearer token stored in secure storage (auth) or plain storage (fallback).
 */
import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const API_BASE = `${BASE_URL}/api`;
export const TOKEN_KEY = "prankfx.auth.token";

export type UserOut = {
  user_id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  provider: string;
  is_premium: boolean;
  premium_tier?: string | null;
  free_credits_used?: number;
  free_credits_total?: number;
  created_at: string;
};

export type AuthResponse = { token: string; user: UserOut };

export type EffectItem = { id: string; name: string; emoji: string };
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

async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

async function request<T = any>(path: string, opts: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || res.statusText || "Request failed";
    const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail)) as Error & {
      status?: number;
      data?: any;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

// --- Auth ---
export const AuthAPI = {
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }, false),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  forgot: (email: string) =>
    request<{ ok: boolean; message: string }>("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }, false),
  googleSession: (session_id: string) =>
    request<AuthResponse>("/auth/google/session", { method: "POST", body: JSON.stringify({ session_id }) }, false),
  me: () => request<UserOut>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  deleteAccount: () => request<{ ok: boolean }>("/auth/account", { method: "DELETE" }),
};

// --- Effects ---
export const EffectsAPI = {
  catalog: () => request<{ categories: CategoryItem[] }>("/effects", { method: "GET" }, false),
};

// --- Generate ---
export const GenAPI = {
  generate: (image_base64: string, effect_id: string, save_to_history = true) =>
    request<ProjectFull>("/generate", {
      method: "POST",
      body: JSON.stringify({ image_base64, effect_id, save_to_history }),
    }),
};

// --- Projects ---
export const ProjectsAPI = {
  list: (opts: { favorites?: boolean; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.favorites) q.set("favorites", "true");
    if (opts.search) q.set("search", opts.search);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ items: ProjectListItem[] }>(`/projects${suffix}`);
  },
  get: (id: string) => request<ProjectFull>(`/projects/${id}`),
  setFavorite: (id: string, is_favorite: boolean) =>
    request<{ ok: boolean; is_favorite: boolean }>(`/projects/${id}/favorite`, {
      method: "PATCH",
      body: JSON.stringify({ is_favorite }),
    }),
  remove: (id: string) => request<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),
};

// --- Subscription ---
export type CreditsInfo = {
  is_premium: boolean;
  premium_tier: string | null;
  free_credits_used: number;
  free_credits_total: number;
  free_credits_remaining: number;
};

export const SubAPI = {
  mockActivate: (tier: "face_effects" | "ultimate", interval: "month" | "year") =>
    request<{ ok: boolean; tier: string; interval: string }>("/subscription/mock-activate", {
      method: "POST",
      body: JSON.stringify({ tier, interval }),
    }),
  restore: () => request<{ is_premium: boolean; premium_tier: string | null }>("/subscription/restore", { method: "POST" }),
  cancel: () => request<{ ok: boolean }>("/subscription/cancel", { method: "POST" }),
  credits: () => request<CreditsInfo>("/subscription/credits"),
};
