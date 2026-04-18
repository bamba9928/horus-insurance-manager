/**
 * Fixtures Playwright : injecte automatiquement le shim Tauri avant chaque
 * navigation pour que `@tauri-apps/api/core::invoke` fonctionne sans runtime
 * Tauri réel.
 */

import { test as base, expect } from "@playwright/test";
import { installTauriMock } from "./mock-tauri";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(installTauriMock);
    // Force la locale FR par défaut pour les tests (le navigateur Playwright
    // est en-US par défaut, ce qui ferait basculer l'app en anglais).
    await page.addInitScript(() => {
      try {
        if (!window.localStorage.getItem("ham-lang")) {
          window.localStorage.setItem("ham-lang", "fr");
        }
      } catch {
        // ignore
      }
    });
    await use(page);
  },
});

export { expect };
