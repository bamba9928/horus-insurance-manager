import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;
// Dev local du mode web (VITE_API_MODE=http) : proxy /api vers le serveur
// Node local pour éviter le CORS entre localhost:1420 et le backend.
// Sans effet en mode desktop (Tauri n'appelle jamais /api).
const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || "http://localhost:3000";

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    proxy: {
      "/api": { target: devApiProxyTarget, changeOrigin: true },
    },
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
