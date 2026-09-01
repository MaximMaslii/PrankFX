import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AuthAPI,
  UserOut,
  clearToken,
  setToken,
} from "@/src/api/client";

type AuthContextValue = {
  user: UserOut | null;
  loading: boolean;
  bootLoading: boolean;

  loginWithEmail: (
    email: string,
    password: string
  ) => Promise<void>;

  registerWithEmail: (
    email: string,
    password: string,
    name?: string
  ) => Promise<void>;

  loginWithGoogle: (
    token: string
  ) => Promise<void>;

  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  setUser: (u: UserOut | null) => void;
};

const AuthContext =
  createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<UserOut | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [bootLoading, setBootLoading] =
    useState(true);

  // =====================================================
  // REFRESH CURRENT USER
  // =====================================================

  const refresh = useCallback(async () => {
    try {
      const me = await AuthAPI.me();

      setUser(me);
    } catch {
      setUser(null);

      await clearToken();
    }
  }, []);

  // =====================================================
  // APP START
  // =====================================================

  useEffect(() => {
    (async () => {
      await refresh();

      setBootLoading(false);
    })();
  }, [refresh]);

  // =====================================================
  // EMAIL LOGIN
  // =====================================================

  const loginWithEmail = useCallback(
    async (
      email: string,
      password: string
    ) => {
      setLoading(true);

      try {
        const res =
          await AuthAPI.login(
            email,
            password
          );

        await setToken(res.token);

        setUser(res.user);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =====================================================
  // EMAIL REGISTER
  // =====================================================

  const registerWithEmail = useCallback(
    async (
      email: string,
      password: string,
      name?: string
    ) => {
      setLoading(true);

      try {
        const res =
          await AuthAPI.register(
            email,
            password,
            name
          );

        await setToken(res.token);

        setUser(res.user);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =====================================================
  // GOOGLE LOGIN
  // =====================================================

  const loginWithGoogle = useCallback(
    async (token: string) => {
      setLoading(true);

      try {
        const res = await AuthAPI.googleLogin(token);

        console.log(
          "AUTH GOOGLE RESPONSE USER:",
          JSON.stringify(res.user, null, 2)
        );

        console.log(
          "AUTH GOOGLE NEW TOKEN RECEIVED:",
          !!res.token
        );

        await setToken(res.token);

        console.log(
          "AUTH GOOGLE TOKEN SAVED, USER:",
          res.user.email
        );

        setUser(res.user);

        console.log(
          "AUTH GOOGLE USER STATE SET:",
          res.user.email
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = useCallback(async () => {
    try {
      await AuthAPI.logout();
    } catch {
      // Ignore logout API errors.
    }

    await clearToken();

    setUser(null);
  }, []);

  // =====================================================
  // DELETE ACCOUNT
  // =====================================================

  const deleteAccount =
    useCallback(async () => {
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

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        loading,
        bootLoading,

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

        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,

        refresh,
        logout,
        deleteAccount,
      ]
    );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx =
    useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return ctx;
}