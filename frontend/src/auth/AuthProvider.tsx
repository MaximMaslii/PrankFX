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
import { configurePurchases, logOutPurchases } from "@/src/utils/purchases";
import { clearDeviceId, getDeviceId } from "@/src/utils/deviceId";

type AuthContextValue = {
  user: UserOut | null;
  loading: boolean;
  bootLoading: boolean;

  /**
   * Signed in without an account. Everything works except buying — the
   * paywall asks for an account first, because a purchase has to belong to
   * something the person can sign back into.
   */
  isGuest: boolean;

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

  loginWithApple: (token: string, fullName?: string) => Promise<void>;

  /** Start a session with no account. Safe to call when already signed in. */
  continueAsGuest: () => Promise<void>;

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
  // STORE IDENTITY
  //
  // RevenueCat has to know the purchase belongs to THIS account before the
  // purchase happens — the webhook carries `app_user_id`, and if that is an
  // anonymous id the credits land nowhere.
  // =====================================================

  useEffect(() => {
    configurePurchases(user?.user_id ?? null);
  }, [user?.user_id]);

  // =====================================================
  // GUEST SESSION
  //
  // Called by the navigation gate when there is no session and onboarding is
  // done, instead of sending the user to a registration form. The server key
  // is this device's own id, so calling it twice returns the same account
  // rather than a second one with a second free credit.
  // =====================================================

  const continueAsGuest = useCallback(async () => {
    setLoading(true);

    try {
      const deviceId = await getDeviceId();
      const res = await AuthAPI.guest(deviceId);

      await setToken(res.token);

      setUser(res.user);
      setOffline(false);
    } finally {
      setLoading(false);
    }
  }, []);

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
  // APPLE LOGIN
  //
  // Same shape as Google. The name is forwarded because Apple hands it to the
  // client on the first sign-in only and never puts it in the token.
  // =====================================================

  const loginWithApple = useCallback(
    async (identityToken: string, fullName?: string) => {
      setLoading(true);

      try {
        const res = await AuthAPI.appleLogin(identityToken, fullName);

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
    },
    [],
  );

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
    await logOutPurchases();

    // Also drop the guest identity. Without this, signing out of a real
    // account would drop the user straight back into the guest session that
    // account grew out of — which looks like the sign-out did nothing.
    await clearDeviceId();

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
      await clearDeviceId();
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
      isGuest: !!user?.is_guest,

      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      loginWithApple,
      continueAsGuest,

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
      loginWithApple,
      continueAsGuest,
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
