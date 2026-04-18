/**
 * Tests E2E — Ouverture des dialogues de création depuis les pages CRUD.
 */

import { expect, test } from "./fixtures";

test("ouvre le dialogue de création client", async ({ page }) => {
  await page.goto("/clients");
  // Bouton "+ Créer" dans le header (i18n: common.create = "Créer")
  await page.getByRole("button", { name: /créer/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/nouveau client/i);
  // Fermer via la croix
  await dialog.locator('button:has-text("×")').click();
});

test("ouvre le dialogue de création assureur dans les paramètres", async ({ page }) => {
  await page.goto("/parametres");
  await page.getByRole("button", { name: /nouvel assureur/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/nouvel assureur/i);
});
