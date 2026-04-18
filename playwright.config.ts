/**
 * Configuration Playwright pour les tests E2E.
 *
 * Stratégie : l'application Tauri est testée via le serveur Vite dev
 * (http://localhost:1420) avec un shim qui mocke `window.__TAURI_INTERNALS__`
 * et `tauri-plugin-sql`. Les tests se concentrent sur la couche UI (navigation,
 * formulaires, dark mode, i18n) sans dépendre du runtime Tauri ou d'un vrai SQLite.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 1420;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
