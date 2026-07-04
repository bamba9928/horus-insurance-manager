/**
 * Authentification côté client (mode web uniquement).
 * En mode desktop (Tauri), `isWebMode` est faux : l'app n'est pas protégée
 * et le contexte reste au défaut (aucun utilisateur, aucun appel réseau).
 *
 * @module auth
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Vrai si l'app tourne en mode web (API HTTP + authentification). */
export const isWebMode = import.meta.env.VITE_API_MODE === "http";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface AuthUser {
  id: number;
  login: string;
  nom: string;
  role: "ADMIN" | "USER";
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const defaultState: AuthState = {
  user: null,
  loading: false,
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

  // Récupère la session existante au démarrage.
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: AuthUser } | null) => {
        if (!cancelled) setUser(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(
      () => {},
    );
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}
