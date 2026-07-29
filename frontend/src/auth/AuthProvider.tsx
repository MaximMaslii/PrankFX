import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthAPI, UserOut, clearToken, setToken } from "@/src/api/client";

type AuthContextValue = {
  user: UserOut | null;
  loading: boolean;
  bootLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogleSession: (session_id: string) => Promise<void>;
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

  const refresh = useCallback(async () => {
    try {
      const me = await AuthAPI.me();
      setUser(me);
    } catch {
      setUser(null);
      await clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setBootLoading(false);
    })();
  }, [refresh]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await AuthAPI.login(email, password);
      await setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const res = await AuthAPI.register(email, password, name);
      await setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogleSession = useCallback(async (session_id: string) => {
    setLoading(true);
    try {
      const res = await AuthAPI.googleSession(session_id);
      await setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthAPI.logout();
    } catch {
      // ignore
    }
    await clearToken();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await AuthAPI.deleteAccount();
    } finally {
      await clearToken();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, bootLoading,
    loginWithEmail, registerWithEmail, loginWithGoogleSession,
    refresh, logout, deleteAccount, setUser,
  }), [user, loading, bootLoading, loginWithEmail, registerWithEmail, loginWithGoogleSession, refresh, logout, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
