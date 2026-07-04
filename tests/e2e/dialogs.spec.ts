/**
 * Tests E2E — Ouverture des dialogues de création depuis les pages CRUD.
 */

import { expect, test } from "./fixtures";

test("ouvre le dialogue de création de dossier", async ({ page }) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: /nouveau dossier/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/nouveau dossier/i);
  // Fermer via la croix
  await dialog.locator('button:has-text("×")').click();
});

test("ouvre le dialogue d'ajout de compagnie dans les paramètres", async ({ page }) => {
  await page.goto("/parametres");
  await page.getByRole("button", { name: /ajouter une compagnie/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/ajouter une compagnie/i);
});
