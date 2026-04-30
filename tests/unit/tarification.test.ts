import { describe, expect, it } from "vitest";
import { computeTarif, getDefaultFrais, TarifError } from "../../src/lib/tarification";

describe("computeTarif — CAT 01 VP", () => {
  it("12 mois, 7 CV, bonus 20% — calcul de référence", () => {
    const r = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 7,
      dureeMois: 12,
      frais: 3000,
    });
    expect(r.rcAnnuel).toBe(51078);
    expect(r.rCivil).toBe(40862);
    expect(r.primeNette).toBe(40862);
    expect(r.taxe).toBe(6141);
    expect(r.fga).toBe(1022);
    expect(r.carteBrune).toBe(300);
    expect(r.primeTotale).toBe(51325);
    expect(r.commission).toBe(8172);
    expect(r.netAVerser).toBe(40153);
    expect(r.tauxCommission).toBe(0.2);
  });

  it("prorata 6 mois utilise la formule × 8.75% × mois", () => {
    const r = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 7,
      dureeMois: 6,
      frais: 3000,
    });
    expect(r.rCivil).toBe(21453);
    expect(r.primeTotale).toBe(28712);
    expect(r.netAVerser).toBe(21421);
  });

  it("respecte les bornes des tranches CV", () => {
    expect(
      computeTarif({ categorie: "CAT_01_VP", puissance: 6, dureeMois: 12, frais: 3000 }).rcAnnuel,
    ).toBe(45181);
    expect(
      computeTarif({ categorie: "CAT_01_VP", puissance: 7, dureeMois: 12, frais: 3000 }).rcAnnuel,
    ).toBe(51078);
    expect(
      computeTarif({ categorie: "CAT_01_VP", puissance: 24, dureeMois: 12, frais: 3000 }).rcAnnuel,
    ).toBe(104143);
    expect(
      computeTarif({ categorie: "CAT_01_VP", puissance: 99, dureeMois: 12, frais: 3000 }).rcAnnuel,
    ).toBe(104143);
  });

  it("bonus paramétrable", () => {
    const r = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 7,
      dureeMois: 12,
      frais: 3000,
      bonus: 0,
    });
    expect(r.rCivil).toBe(51078);
  });
});

describe("computeTarif — TPV (commission 8%, pas de carte brune)", () => {
  it("Taxi urbain 7 CV — applique commission 8% et carte brune 0", () => {
    const r = computeTarif({
      categorie: "CAT_04_TAXI_URBAIN",
      puissance: 7,
      dureeMois: 12,
      frais: 1000,
    });
    expect(r.rcAnnuel).toBe(145960);
    expect(r.rCivil).toBe(116768);
    expect(r.carteBrune).toBe(0);
    expect(r.tauxCommission).toBe(0.08);
    expect(r.commission).toBe(9341);
  });

  it("Autocar/Minicar additionne base CV + surprime places", () => {
    const r = computeTarif({
      categorie: "CAT_04_AUTOCAR_MINICAR",
      puissance: 7,
      places: 25,
      dureeMois: 12,
      frais: 1000,
    });
    // base 117587 + (25-1) × 9415 = 117587 + 225960 = 343547
    expect(r.rcAnnuel).toBe(343547);
    expect(r.tauxCommission).toBe(0.08);
    expect(r.carteBrune).toBe(0);
  });

  it("Autocar > 31 places utilise le tarif réduit au-delà de 30", () => {
    const r = computeTarif({
      categorie: "CAT_04_AUTOCAR_MINICAR",
      puissance: 7,
      places: 50,
      dureeMois: 12,
      frais: 1000,
    });
    // base 117587 + 30 × 9415 + (50-31) × 6726 = 117587 + 282450 + 127794 = 527831
    expect(r.rcAnnuel).toBe(527831);
  });
});

describe("computeTarif — CAT 05 2R et Tricycle", () => {
  it("Scooter -125cm³", () => {
    const r = computeTarif({
      categorie: "CAT_05_2R",
      cylindree: "LT_125",
      dureeMois: 12,
      frais: 3000,
    });
    expect(r.rcAnnuel).toBe(18780);
  });

  it("Tricycle utilise un RC fixe", () => {
    const r = computeTarif({
      categorie: "TRICYCLE",
      dureeMois: 12,
      frais: 3000,
    });
    expect(r.rcAnnuel).toBe(40880);
    expect(r.carteBrune).toBe(300);
    expect(r.tauxCommission).toBe(0.2);
  });
});

describe("computeTarif — erreurs", () => {
  it("rejette une durée invalide", () => {
    expect(() =>
      computeTarif({ categorie: "CAT_01_VP", puissance: 7, dureeMois: 0, frais: 3000 }),
    ).toThrow(TarifError);
    expect(() =>
      computeTarif({ categorie: "CAT_01_VP", puissance: 7, dureeMois: 13, frais: 3000 }),
    ).toThrow(TarifError);
  });

  it("exige une puissance pour les catégories CV", () => {
    expect(() => computeTarif({ categorie: "CAT_01_VP", dureeMois: 12, frais: 3000 })).toThrow(
      TarifError,
    );
  });

  it("exige une cylindrée pour CAT 5", () => {
    expect(() => computeTarif({ categorie: "CAT_05_2R", dureeMois: 12, frais: 3000 })).toThrow(
      TarifError,
    );
  });

  it("exige un nombre de places pour Autocar/Minicar", () => {
    expect(() =>
      computeTarif({
        categorie: "CAT_04_AUTOCAR_MINICAR",
        puissance: 7,
        dureeMois: 12,
        frais: 1000,
      }),
    ).toThrow(TarifError);
  });

  it("rejette une puissance hors plafond CV pour Taxi", () => {
    expect(() =>
      computeTarif({
        categorie: "CAT_04_TAXI_URBAIN",
        puissance: 17,
        dureeMois: 12,
        frais: 1000,
      }),
    ).toThrow(/16 CV/);
  });
});

describe("getDefaultFrais", () => {
  it("retourne 2000 pour les TPV", () => {
    expect(getDefaultFrais("CAT_04_TAXI_URBAIN")).toBe(2000);
    expect(getDefaultFrais("CAT_04_AUTOCAR_MINICAR")).toBe(2000);
  });

  it("retourne 3000 pour les autres catégories", () => {
    expect(getDefaultFrais("CAT_01_VP")).toBe(3000);
    expect(getDefaultFrais("CAT_05_2R")).toBe(3000);
    expect(getDefaultFrais("TRICYCLE")).toBe(3000);
  });
});
