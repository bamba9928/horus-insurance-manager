/**
 * Hook de gestion du thème clair/sombre/système.
 * Persiste la préférence dans localStorage et applique la classe `dark`
 * sur <html> selon le choix + les préférences système en mode "system".
 *
 * @module hooks/useTheme
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ham-theme";

export type Theme = "light" | "dark" | "system";

/** Applique ou retire la classe `dark` sur l'élément racine. */
function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

/** Lit la préférence de thème depuis localStorage (fallback `system`). */
function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** Hook principal : expose le thème courant et la fonction de changement. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  // Appliquer le thème au montage + quand il change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Écouter les changements du système quand mode = "system"
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, t);
    }
    setThemeState(t);
  }, []);

  return { theme, setTheme };
}

/**
 * Initialise le thème dès le démarrage (avant le rendu React) pour éviter
 * un flash de thème incorrect. À appeler dans `main.tsx` avant `createRoot`.
 */
export function initTheme(): void {
  applyTheme(readStoredTheme());
}
