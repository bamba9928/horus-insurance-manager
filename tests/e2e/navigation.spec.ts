/**
 * Tests E2E — Navigation entre toutes les pages de l'application.
 * Vérifie que chaque route se charge et affiche le header attendu.
 */

import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("ham-theme");
    } catch {
      // ignore
    }
  });
});

test("charge le dashboard par défaut", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /tableau de bord/i })).toBeVisible();
  await expect(page.getByText(/polices actives/i)).toBeVisible();
  await expect(page.getByText(/échéances 30j/i)).toBeVisible();
});

test("navigue vers toutes les pages principales", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation");
  const pages: Array<{ linkText: RegExp; heading: RegExp }> = [
    { linkText: /clients/i, heading: /^clients$/i },
    { linkText: /véhicules/i, heading: /^véhicules$/i },
    { linkText: /polices/i, heading: /^polices$/i },
    { linkText: /paiements/i, heading: /^paiements$/i },
    { linkText: /échéances/i, heading: /^échéances$/i },
    { linkText: /paramètres/i, heading: /^paramètres$/i },
  ];

  for (const { linkText, heading } of pages) {
    await nav.getByRole("link", { name: linkText }).click();
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
});

test("affiche le message « aucune donnée » sur la liste clients vide", async ({ page }) => {
  await page.goto("/clients");
  await expect(page.getByRole("heading", { level: 2, name: /^clients$/i })).toBeVisible();
  await expect(page.getByText(/aucune donnée/i)).toBeVisible();
});
