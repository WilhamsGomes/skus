import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, onUnauthorized, tokenStore } from "../api/client";
import type { LoginResponse } from "../api/types";

const USER_KEY = "sku-dashboard.user";

interface AuthState {
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

function writeUser(username: string | null): void {
  try {
    if (username) localStorage.setItem(USER_KEY, username);
    else localStorage.removeItem(USER_KEY);
  } catch {
    return;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [username, setUsername] = useState<string | null>(() => readUser());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    tokenStore.clear();
    writeUser(null);
    setToken(null);
    setUsername(null);
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => {
    onUnauthorized(logout);
    return () => onUnauthorized(null);
  }, [logout]);

  const login = useCallback(async (user: string, password: string) => {
    const response = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: user, password }),
    });
    tokenStore.set(response.accessToken);
    writeUser(response.username);
    setToken(response.accessToken);
    setUsername(response.username);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ username, isAuthenticated: Boolean(token), login, logout }),
    [username, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
