import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, onUnauthorized, setToken } from "../lib/api";
import type { User } from "../lib/types";

interface AuthValue {
  user: User | null;
  /** True after a signed-in session was ended by the server (expired token). */
  sessionEnded: boolean;
  /** True until we know whether the saved token is still valid. */
  checking: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [checking, setChecking] = useState(() => getToken() !== null);

  const signIn = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
    setSessionEnded(false);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Restore the session from a saved token.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api.me().then(
      (u) => {
        if (cancelled) return;
        setUser(u);
        setChecking(false);
      },
      () => {
        if (cancelled) return;
        setToken(null);
        setChecking(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Any later 401 means the session ended. Clearing the user sends every protected page to sign in,
  // and the sign-in page uses `sessionEnded` to explain why.
  useEffect(() => {
    onUnauthorized(() => {
      setToken(null);
      setUser(null);
      setSessionEnded(true);
    });
    return () => onUnauthorized(null);
  }, []);

  const value = useMemo(() => ({ user, sessionEnded, checking, signIn, signOut }), [user, sessionEnded, checking, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
