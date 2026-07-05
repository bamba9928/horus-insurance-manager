/**
 * Authentification côté client (mode web uniquement).
 * En mode desktop (Tauri), `isWebMode` est faux : l'app n'est pas protégée
 * et le contexte reste au défaut (aucun utilisateur, aucun appel réseau).
 *
 * @module auth
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { csrfHeaders } from "./csrf";

/** Vrai si l'app tourne en mode web (API HTTP + authentification). */
export const isWebMode = import.meta.env.VITE_API_MODE === "http";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface AuthUser {
  id: number;
  login: string;
  nom: string;
  prenom: string | null;
  adresse: string | null;
  telephone1: string | null;
  telephone2: string | null;
  email: string | null;
  role: "ADMIN" | "USER";
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const defaultState: AuthState = {
  user: null,
  loading: false,
  refresh: async () => null,
  login: async () => {
    throw new Error("Authentification indisponible");
  },
  logout: async () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

/** Lecture de l'état d'authentification (sûr même sans provider → desktop). */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await fetch(`${BASE}/api/me`, { credentials: "include" });
      const data = res.ok ? ((await res.json()) as { user: AuthUser }) : null;
      return data?.user ?? null;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    const nextUser = await fetchCurrentUser();
    setUser(nextUser);
    return nextUser;
  }, [fetchCurrentUser]);

  // Récupère la session existante au démarrage.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((nextUser) => {
        if (!cancelled) setUser(nextUser);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCurrentUser]);

  const login = useCallback(async (loginName: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: loginName, password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Échec de la connexion");
    }
    const data = (await res.json()) as { user: AuthUser };
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders("POST"),
    }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
