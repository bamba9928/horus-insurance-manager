/**
 * Tests E2E — page Tarification TPV (CAT 04).
 */

import { expect, test } from "./fixtures";

test("calcule un minicar depuis la page TPV, frais par défaut 2000", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "TPV" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Tarification TPV" })).toBeVisible();

  await expect(page.getByLabel(/frais/i)).toHaveValue("2000");
  await page.getByLabel(/puissance fiscale/i).fill("9");
  await page.getByLabel(/nombre de places/i).fill("15");
  await page.getByLabel(/^durée/i).fill("12");
  await page.getByRole("button", { name: /valider le calcul/i }).click();

  await expect(page.getByText("Minicar", { exact: true })).toBeVisible();
  await expect(page.getByText(/356\s034 FCFA/)).toHaveCount(2);
  await expect(page.getByText(/418\s500 FCFA/)).toBeVisible();
});

test("les frais restent modifiables", async ({ page }) => {
  await page.goto("/tarification/tpv");
  await page.getByLabel(/puissance fiscale/i).fill("6");
  await page.getByLabel(/nombre de places/i).fill("5");
  await page.getByLabel(/^durée/i).fill("1");
  await page.getByLabel(/frais/i).fill("1000");
  await page.getByRole("button", { name: /valider le calcul/i }).click();

  // Taxi 6 CV (tranche 3 à 6), 5 places, 1 mois : RC 11 282 + IC 1 000 + frais 1 000 + taxe 1 859 + FGA 282 + CEDEAO 300.
  await expect(page.getByText(/15\s723 FCFA/)).toBeVisible();
});

test("la carte brune CEDEAO est facultative", async ({ page }) => {
  await page.goto("/tarification/tpv");
  await page.getByLabel(/puissance fiscale/i).fill("6");
  await page.getByLabel(/nombre de places/i).fill("5");
  await page.getByLabel(/^durée/i).fill("1");
  await page.getByLabel(/frais/i).fill("1000");
  await page.getByLabel(/carte brune cedeao/i).uncheck();
  await page.getByRole("button", { name: /valider le calcul/i }).click();

  await expect(page.getByText(/15\s423 FCFA/)).toBeVisible();
  await expect(page.getByText("Carte brune CEDEAO", { exact: true })).toHaveCount(0);
});

test("la commission est paramétrable, 8 % par défaut", async ({ page }) => {
  await page.goto("/tarification/tpv");
  await expect(page.getByLabel(/commission/i)).toHaveValue("8");
  await page.getByLabel(/puissance fiscale/i).fill("6");
  await page.getByLabel(/nombre de places/i).fill("5");
  await page.getByLabel(/^durée/i).fill("12");
  await page.getByLabel(/commission/i).fill("10");
  await page.getByRole("button", { name: /valider le calcul/i }).click();

  await expect(page.getByText("Commission (10 %)")).toBeVisible();
  // 10 % × prime nette (128 938 + 1 000).
  await expect(page.getByText(/12\s994 FCFA/)).toBeVisible();

  await page.getByRole("button", { name: /réinitialiser/i }).click();
  await expect(page.getByLabel(/commission/i)).toHaveValue("8");
});

test("le genre car n'affiche pas de libellé taxi", async ({ page }) => {
  await page.goto("/tarification/tpv");
  await page.getByLabel(/^genre/i).selectOption("CAR");
  await page.getByLabel(/puissance fiscale/i).fill("5");
  await page.getByLabel(/nombre de places/i).fill("5");
  await page.getByLabel(/^durée/i).fill("12");
  await page.getByRole("button", { name: /valider le calcul/i }).click();

  await expect(page.getByText("Car / minibus", { exact: true })).toBeVisible();
  await expect(page.getByText("Taxi urbain", { exact: true })).toHaveCount(0);
  // Tranche car 5 à 7 CV : 117 587 + 28 373.
  await expect(page.getByText(/145\s960 FCFA/)).toHaveCount(2);
});

test("la liste générale ne propose plus le TPV", async ({ page }) => {
  await page.goto("/tarification");
  await page.locator("#tarif-cat").click();

  await expect(page.getByRole("option", { name: /CAT 01/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /TPV/ })).toHaveCount(0);
});
