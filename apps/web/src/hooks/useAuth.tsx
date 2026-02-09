"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { auth as authApi, setAccessToken } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Try to restore token from sessionStorage
    const stored = sessionStorage.getItem("access_token");
    if (stored) {
      setAccessToken(stored);
    }

    authApi
      .me()
      .then((u: any) => setUser(u))
      .catch(() => {
        setUser(null);
        setAccessToken(null);
        sessionStorage.removeItem("access_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res: any = await authApi.login(email, password);
    // Store the token for Bearer auth (needed when proxied through Next.js)
    if (res.access_token) {
      setAccessToken(res.access_token);
      sessionStorage.setItem("access_token", res.access_token);
    }
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, role = "player") => {
      const res: any = await authApi.register(email, password, role);
      if (res.access_token) {
        setAccessToken(res.access_token);
        sessionStorage.setItem("access_token", res.access_token);
      }
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setAccessToken(null);
    sessionStorage.removeItem("access_token");
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
