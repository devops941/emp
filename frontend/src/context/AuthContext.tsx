"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import api from "@/lib/api";
import { tokenStore } from "@/lib/token";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_EXPIRE_MS = 55 * 60 * 1000; // refresh 5 min before 60 min expiry

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) return;
      try {
        const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token: newRefresh, user: u } = res.data;
        tokenStore.set(access_token);
        setToken(access_token);
        localStorage.setItem("refresh_token", newRefresh);
        localStorage.setItem("user", JSON.stringify(u));
        scheduleRefresh();
      } catch {
        await doLogout();
      }
    }, ACCESS_EXPIRE_MS);
  };

  const doLogout = async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      await api.post("/api/auth/logout");
    } catch {}
    tokenStore.set(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  };

  useEffect(() => {
    const storedRefresh = localStorage.getItem("refresh_token");
    const storedUser = localStorage.getItem("user");
    if (storedRefresh && storedUser) {
      axios
        .post(`${API_BASE}/api/auth/refresh`, { refresh_token: storedRefresh })
        .then((res) => {
          const { access_token, refresh_token: newRefresh, user: u } = res.data;
          tokenStore.set(access_token);
          setToken(access_token);
          setUser(u);
          localStorage.setItem("refresh_token", newRefresh);
          localStorage.setItem("user", JSON.stringify(u));
          scheduleRefresh();
        })
        .catch(() => {
          tokenStore.set(null);
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    const { access_token, refresh_token, user: u } = res.data;
    tokenStore.set(access_token);
    setToken(access_token);
    setUser(u);
    localStorage.setItem("refresh_token", refresh_token);
    localStorage.setItem("user", JSON.stringify(u));
    scheduleRefresh();
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.post("/api/auth/register", { name, email, password });
    const { access_token, refresh_token, user: u } = res.data;
    tokenStore.set(access_token);
    setToken(access_token);
    setUser(u);
    localStorage.setItem("refresh_token", refresh_token);
    localStorage.setItem("user", JSON.stringify(u));
    scheduleRefresh();
  };

  const logout = async () => {
    await doLogout();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
