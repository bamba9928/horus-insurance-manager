/**
 * Tests E2E — Apparence : langue (FR/EN) et thème (light/dark/system).
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

test("bascule en anglais et les libellés de navigation changent", async ({ page }) => {
  await page.goto("/parametres");
  await expect(page.getByRole("heading", { level: 2, name: /paramètres/i })).toBeVisible();

  const langSelect = page.locator("#lang-select");
  await expect(langSelect).toHaveValue("fr");

  await langSelect.selectOption("en");

  const nav = page.getByRole("navigation");
  // Le libellé du lien passe en anglais — on cible par substring (emoji préfixe).
  await expect(nav.getByRole("link", { name: /dashboard/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /vehicles/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /settings/i })).toBeVisible();

  // Le heading de la page devient "Settings"
  await expect(page.getByRole("heading", { level: 2, name: /settings/i })).toBeVisible();

  // Persistance après rechargement
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: /settings/i })).toBeVisible();
});

test("active le mode sombre via le sélecteur et la classe `dark` est appliquée", async ({
  page,
}) => {
  await page.goto("/parametres");
  // État initial : pas de classe dark
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  await page.locator("#theme-select").selectOption("dark");

  // Attendre la propagation de l'effet (React effect + classList.toggle)
  await expect.poll(() => page.locator("html").getAttribute("class")).toContain("dark");
});

test("la préférence dark est persistée dans localStorage", async ({ page }) => {
  // Pré-charge directement la préférence sans passer par l'UI
  await page.addInitScript(() => {
    window.localStorage.setItem("ham-theme", "dark");
  });
  await page.goto("/parametres");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
