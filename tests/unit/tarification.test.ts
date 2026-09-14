import { describe, expect, it } from "vitest";
import {
  computeTarif,
  getDefaultBonus,
  getDefaultFrais,
  TarifError,
} from "../../src/lib/tarification";

describe("computeTarif — CAT 01 VP", () => {
  it("12 mois, 7 CV, réduction 20% — calcul de référence", () => {
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

  it("réduction paramétrable et appliquée à la responsabilité civile", () => {
    const sansReduction = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 7,
      dureeMois: 12,
      frais: 3000,
      bonus: 0,
    });
    const reduction50 = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 7,
      dureeMois: 12,
      frais: 3000,
      bonus: 0.5,
    });

    expect(sansReduction.rCivil).toBe(51078);
    expect(reduction50.rCivil).toBe(25539);
    expect(reduction50.primeTotale).toBeLessThan(sansReduction.primeTotale);
  });

  it("frais de police paramétrables et intégrés à la taxe, prime totale et net à verser", () => {
    const sansFrais = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 7,
      dureeMois: 12,
      frais: 0,
    });
    const frais5000 = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 7,
      dureeMois: 12,
      frais: 5000,
    });

    expect(frais5000.frais).toBe(5000);
    expect(frais5000.rCivil).toBe(sansFrais.rCivil);
    expect(frais5000.taxe - sansFrais.taxe).toBe(700);
    expect(frais5000.primeTotale - sansFrais.primeTotale).toBe(5700);
    expect(frais5000.netAVerser - sansFrais.netAVerser).toBe(700);
  });
});

describe("computeTarif — décomptes réels ASS", () => {
  it("VP 9 CV, 3 mois, réduction 20 %", () => {
    const r = computeTarif({ categorie: "CAT_01_VP", puissance: 9, dureeMois: 3, frais: 3000 });
    expect(r.rcProrata).toBe(13408);
    expect(r.reduction).toBe(2682);
    expect(r.rCivil).toBe(10726);
    expect(r.taxe).toBe(1922);
    expect(r.fga).toBe(268);
    expect(r.carteBrune).toBe(300);
    expect(r.primeTotale).toBe(16216);
  });

  it("TPC > 3T500, 15 CV, 1 mois — réduction TPC par défaut 40 % (× 0,608)", () => {
    const r = computeTarif({
      categorie: "CAT_02_TPC_GT3T5",
      puissance: 15,
      dureeMois: 1,
      frais: 1000,
    });
    expect(r.rcAnnuel).toBe(208597);
    expect(r.rcProrata).toBe(18252);
    expect(r.reduction).toBe(7155);
    expect(r.rCivil).toBe(11097);
    expect(r.taxe).toBe(1694);
    expect(r.fga).toBe(277);
    expect(r.primeTotale).toBe(14368);
  });

  it("TPC > 3T500, 16 CV, 20 jours — prorata ROUND(jours/365 ; 3)", () => {
    const r = computeTarif({
      categorie: "CAT_02_TPC_GT3T5",
      puissance: 16,
      dureeJours: 20,
      frais: 1000,
    });
    expect(r.coefficientDuree).toBe(0.055);
    expect(r.rcProrata).toBe(11473);
    expect(r.rCivil).toBe(6976);
  });

  it("TPC Break 10 CV, 6 mois", () => {
    const r = computeTarif({
      categorie: "CAT_02_TPC_LT3T5_FGTTE",
      puissance: 10,
      dureeMois: 6,
      frais: 1000,
    });
    expect(r.rcAnnuel).toBe(113944);
    expect(r.rcProrata).toBe(59821);
    expect(r.rCivil).toBe(36371);
  });

  it("VP 3 CV, 10 jours", () => {
    const r = computeTarif({ categorie: "CAT_01_VP", puissance: 3, dureeJours: 10, frais: 3000 });
    expect(r.rcProrata).toBe(1220);
  });

  it("VP 11 CV, 12 mois, réduction 40 %", () => {
    const r = computeTarif({
      categorie: "CAT_01_VP",
      puissance: 11,
      dureeMois: 12,
      frais: 3000,
      bonus: 0.4,
    });
    expect(r.rCivil).toBe(39406);
  });

  it("Taxi 7 CV, 1 mois — pas de réduction ni CEDEAO", () => {
    const r = computeTarif({
      categorie: "CAT_04_TAXI_URBAIN",
      puissance: 7,
      dureeMois: 1,
      frais: 1000,
    });
    expect(r.rcProrata).toBe(12772);
    expect(r.rCivil).toBe(12772);
    expect(r.carteBrune).toBe(0);
  });

  it("Moto > 125 cm³, 6 mois", () => {
    const r = computeTarif({
      categorie: "CAT_05_2R",
      cylindree: "GT_125",
      dureeMois: 6,
      frais: 3000,
    });
    expect(r.rcAnnuel).toBe(34021);
    expect(r.rcProrata).toBe(17861);
    expect(r.rCivil).toBe(14289);
    expect(r.taxe).toBe(2420);
    expect(r.primeTotale).toBe(20366);
  });
});

describe("getDefaultBonus", () => {
  it("TPV 0 %, TPC 40 %, autres 20 %", () => {
    expect(getDefaultBonus("CAT_04_TAXI_URBAIN")).toBe(0);
    expect(getDefaultBonus("CAT_02_TPC_GT3T5")).toBe(0.4);
    expect(getDefaultBonus("CAT_01_VP")).toBe(0.2);
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
    expect(r.rCivil).toBe(145960);
    expect(r.carteBrune).toBe(0);
    expect(r.tauxCommission).toBe(0.08);
    expect(r.commission).toBe(11677);
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
  it("RC annuel des 4 genres 2 roues ASS", () => {
    const rc = (cylindree: "CYCLOMOTEUR" | "LT_125" | "GT_125" | "SIDE_CAR") =>
      computeTarif({ categorie: "CAT_05_2R", cylindree, dureeMois: 12, frais: 3000 }).rcAnnuel;
    expect(rc("CYCLOMOTEUR")).toBe(18780);
    expect(rc("LT_125")).toBe(29448);
    expect(rc("GT_125")).toBe(34021);
    expect(rc("SIDE_CAR")).toBe(40880);
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
    expect(() =>
      computeTarif({ categorie: "CAT_01_VP", puissance: 7, dureeJours: 366, frais: 3000 }),
    ).toThrow(TarifError);
  });

  it("rejette une réduction invalide", () => {
    expect(() =>
      computeTarif({
        categorie: "CAT_01_VP",
        puissance: 7,
        dureeMois: 12,
        frais: 3000,
        bonus: 1.2,
      }),
    ).toThrow(/Réduction invalide/);
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
