/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend de données : "tauri" (desktop, défaut) ou "http" (web). */
  readonly VITE_API_MODE?: "tauri" | "http";
  /** Base URL de l'API web (défaut : même origine). */
  readonly VITE_API_BASE_URL?: string;
  /** URL publique canonique utilisée pour les métadonnées SEO côté client. */
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
