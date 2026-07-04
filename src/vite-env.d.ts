/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend de données : "tauri" (desktop, défaut) ou "http" (web). */
  readonly VITE_API_MODE?: "tauri" | "http";
  /** Base URL de l'API web (défaut : même origine). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
