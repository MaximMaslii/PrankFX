import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ApiError,
  AuthAPI,
  UserOut,
  clearToken,
  getToken,
  setToken,
} from "@/src/api/client";

type AuthContextValue = {
  user: UserOut | null;
  loading: boolean;
  bootLoading: boolean;

  /**
   * True when the last refresh failed because the backend was unreachable
   * (as opposed to the session being invalid). Screens can use this to show
   * "offline" instead of bouncing the user to the login screen.
   */
  offline: boolean;

  loginWithEmail: (email: string, password: string) => Promise<void>;

  registerWithEmail: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<void>;

  loginWithGoogle: (token: string) => Promise<void>;

  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  setUser: (u: UserOut | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // =====================================================
  // REFRESH CURRENT USER
  //
  // Previously ANY failure here wiped the stored token, so a single dropped
  // request (subway, airplane mode, backend restart) silently signed the user
  // out and threw them back to the login screen. Now only a real 401/403 from
  // the server clears the session; network failures keep it and flag `offline`.
  // =====================================================

  const refresh = useCallback(async () => {
    const token = await getToken();

    // No token stored at all — nothing to refresh, and no need to call /me
    // (which would just 401 on every cold start).
    if (!token) {
      setUser(null);
      setOffline(false);
      return;
    }

    try {
      const me = await AuthAPI.me();
      setUser(me);
      setOffline(false);
    } catch (e) {
      const err = e as ApiError;

      if (err?.status === 401 || err?.status === 403) {
        // The session really is invalid — drop it.
        setUser(null);
        setOffline(false);
        await clearToken();
        return;
      }

      // Server down / no connectivity: keep the token, keep the user signed in
      // if we already had them loaded.
      setOffline(true);
    }
  }, []);

  // =====================================================
  // APP START
  // =====================================================

  useEffect(() => {
    let mounted = true;

    (async () => {
      await refresh();
      if (mounted) setBootLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [refresh]);

  // =====================================================
  // EMAIL LOGIN
  // =====================================================

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      setLoading(true);

      try {
        const res = await AuthAPI.login(email, password);
        await setToken(res.token);
        setUser(res.user);
        setOffline(false);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // =====================================================
  // EMAIL REGISTER
  // =====================================================

  const registerWithEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      setLoading(true);

      try {
        const res = await AuthAPI.register(email, password, name);
        await setToken(res.token);
        setUser(res.user);
        setOffline(false);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // =====================================================
  // GOOGLE LOGIN
  //
  // The token is persisted BEFORE the user state flips, so the navigation gate
  // can never fire a protected screen that reads the token before it is stored.
  // =====================================================

  const loginWithGoogle = useCallback(async (idToken: string) => {
    setLoading(true);

    try {
      const res = await AuthAPI.googleLogin(idToken);

      const saved = await setToken(res.token);

      if (!saved) {
        throw new Error(
          "Could not save the session on this device. Check that secure storage is available.",
        );
      }

      setUser(res.user);
      setOffline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = useCallback(async () => {
    try {
      await AuthAPI.logout();
    } catch {
      // A failed logout call must never block clearing the local session.
    }

    await clearToken();
    setUser(null);
    setOffline(false);
  }, []);

  // =====================================================
  // DELETE ACCOUNT
  // =====================================================

  const deleteAccount = useCallback(async () => {
    try {
      await AuthAPI.deleteAccount();
    } finally {
      await clearToken();
      setUser(null);
    }
  }, []);

  // =====================================================
  // CONTEXT VALUE
  // =====================================================

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      bootLoading,
      offline,

      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,

      refresh,
      logout,
      deleteAccount,
      setUser,
    }),
    [
      user,
      loading,
      bootLoading,
      offline,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      refresh,
      logout,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}
