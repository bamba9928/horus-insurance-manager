import { describe, expect, it } from "vitest";
import { computeTarif, TarifError } from "../../src/lib/tarification";
import type { TpvFamille } from "../../src/lib/tarification-tpv";

const tpv = (puissance: number, places: number, dureeMois = 12, frais = 2000) =>
  computeTarif({ categorie: "CAT_04_TPV", puissance, places, dureeMois, frais });

const rcPool = (familleTpv: TpvFamille, puissance: number, places: number) =>
  computeTarif({
    categorie: "CAT_04_TPV",
    familleTpv,
    puissance,
    places,
    dureeMois: 12,
    frais: 2000,
  }).rcAnnuel;

/**
 * Prime nette RC sur 12 mois relevée sur le Pool TPV (préprod) le 14/11/2026,
 * sans garantie annexe : [puissance, places, prime Pool].
 * Taxi = genres TAXI-JAUNE NOIR, TAXI-INTER-URBAIN, VTC.
 */
const POOL_TAXI: [cv: number, places: number, rc: number][] = [
  [2, 5, 113109],
  [3, 5, 128938],
  [5, 5, 128938],
  [6, 5, 128938],
  [7, 5, 145960],
  [10, 5, 145960],
  [11, 5, 196133],
  [14, 5, 196133],
  [15, 5, 252483],
  [23, 5, 252483],
  [24, 5, 290205],
  [30, 5, 290205],
  [5, 4, 128808],
  [5, 6, 149843],
  [7, 6, 166865],
  [5, 7, 174629],
  [5, 8, 199117],
  [5, 9, 231967],
  [7, 9, 248989],
  [11, 9, 299162],
  [5, 10, 288839],
  [5, 20, 288839],
  [10, 15, 305861],
  [12, 15, 356034],
  [5, 21, 288865],
  [8, 21, 305887],
  [5, 25, 326525],
  [16, 25, 450070],
  [24, 25, 487792],
  [5, 30, 373600],
  [5, 31, 383015],
  [5, 32, 389741],
  [5, 45, 477179],
  [17, 45, 600724],
];

/** Car = MINI-CAR, MINI-BUS, CAR RAPIDE, NDIAGA NDIAYE, TATA, ASHOK LEYLAND, bus. */
const POOL_CAR: [cv: number, places: number, rc: number][] = [
  [5, 5, 145960],
  [8, 5, 196133],
  [15, 5, 252483],
  [5, 6, 166865],
  [5, 15, 305861],
  [7, 15, 305861],
  [10, 15, 356034],
  [11, 15, 412384],
  [12, 15, 412384],
  [15, 15, 412384],
  [24, 15, 450106],
];

describe("TPV — RC annuelle relevée sur le Pool TPV", () => {
  it.each(POOL_TAXI)("taxi %i CV, %i places", (cv, places, rc) => {
    expect(rcPool("TAXI", cv, places)).toBe(rc);
  });

  it.each(POOL_CAR)("car %i CV, %i places", (cv, places, rc) => {
    expect(rcPool("CAR", cv, places)).toBe(rc);
  });

  it("prend la famille taxi jusqu'à 9 places, car au-delà", () => {
    expect(tpv(5, 9).rcAnnuel).toBe(rcPool("TAXI", 5, 9));
    expect(tpv(5, 10).rcAnnuel).toBe(rcPool("CAR", 5, 10));
  });
});

describe("TPV — décompte par durée (frais 2000)", () => {
  // Pool, taxi 5 CV, 5 places, 1 mois : RC 11 282, TCA 1 859, FGA 282, total 15 723 (sans Individuelle Conducteur).
  it("taxi 5 CV, 5 places, 1 mois", () => {
    const r = tpv(5, 5, 1);
    expect(r.rCivil).toBe(11282);
    expect(r.primeNette).toBe(12282);
    expect(r.taxe).toBe(1999);
    expect(r.fga).toBe(282);
    expect(r.primeTotale).toBe(15723 + 1140);
  });

  it("minicar 8 à 10 CV, 6 mois", () => {
    const r = tpv(9, 15, 6);
    expect(r.rCivil).toBe(186918);
    expect(r.primeNette).toBe(187918);
    expect(r.taxe).toBe(26589);
    expect(r.fga).toBe(4673);
    expect(r.primeTotale).toBe(221480);
  });

  it("autocar 32 places, 17 CV et plus, 5 mois", () => {
    const r = tpv(18, 32, 5);
    expect(r.rCivil).toBe(241066);
    expect(r.primeNette).toBe(242066);
    expect(r.taxe).toBe(34169);
    expect(r.fga).toBe(6027);
    expect(r.primeTotale).toBe(284562);
  });
});

describe("TPV — alignement sur le Pool TPV", () => {
  it("retombe sur le décompte Pool du minicar 12 CV, 15 places, 1 mois", () => {
    const r = tpv(12, 15, 1);
    expect(r.rCivil).toBe(36084);
    expect(r.primeNette).toBe(37084);
    expect(r.taxe).toBe(5472);
    expect(r.fga).toBe(902);
    expect(r.carteBrune).toBe(300);
    expect(r.primeTotale).toBe(45758);
  });

  // Simulations Pool sans Individuelle Conducteur : l'application la compte toujours (1 000 + 140 de taxe).
  it.each([
    [1, 31153, 38873],
    [6, 186918, 220340],
    [12, 356034, 417360],
  ])("minicar 10 CV, 15 places, %i mois : RC et total du Pool", (mois, rc, totalPool) => {
    const r = tpv(10, 15, mois);
    expect(r.rCivil).toBe(rc);
    expect(r.primeTotale).toBe(totalPool + 1140);
  });

  it.each([1, 6, 12])("Individuelle Conducteur et carte brune fixes sur %i mois", (mois) => {
    const r = tpv(6, 5, mois);
    expect(r.individuelleConducteur).toBe(1000);
    expect(r.primeNette).toBe(r.rCivil + 1000);
    expect(r.carteBrune).toBe(300);
  });

  it("n'ajoute pas d'Individuelle Conducteur hors TPV", () => {
    const r = computeTarif({ categorie: "CAT_01_VP", puissance: 7, dureeMois: 12, frais: 3000 });
    expect(r.individuelleConducteur).toBe(0);
    expect(r.primeNette).toBe(r.rCivil);
  });

  it("calcule la commission sur la prime nette (RC + Individuelle Conducteur)", () => {
    const r = tpv(7, 5);
    expect(r.primeNette).toBe(146960);
    expect(r.commission).toBe(11757); // 146 960 × 8 %
  });

  it("net à verser = TTC − (commission + frais), frais 2 000", () => {
    const r = tpv(7, 5);
    expect(r.frais).toBe(2000);
    expect(r.primeTotale).toBe(173763);
    expect(r.netAVerser).toBe(173763 - (11757 + 2000));
  });

  it("carte brune CEDEAO facultative : 300 de plus sur le TTC si cochée", () => {
    const avec = tpv(7, 5);
    const sans = computeTarif({
      categorie: "CAT_04_TPV",
      puissance: 7,
      places: 5,
      dureeMois: 12,
      frais: 2000,
      carteBrune: false,
    });
    expect(sans.carteBrune).toBe(0);
    expect(avec.carteBrune).toBe(300);
    expect(avec.primeTotale - sans.primeTotale).toBe(300);
    expect(avec.netAVerser - sans.netAVerser).toBe(300);
  });
});

describe("TPV — règles", () => {
  it("applique les frais saisis", () => {
    const sansFrais = tpv(6, 5, 12, 0);
    const avecFrais = tpv(6, 5, 12, 2000);
    expect(avecFrais.frais).toBe(2000);
    expect(avecFrais.primeTotale - sansFrais.primeTotale).toBe(2000 + 280);
  });

  it("n'applique pas de réduction, commission 8 %", () => {
    const r = tpv(6, 5);
    expect(r.reduction).toBe(0);
    expect(r.tauxCommission).toBe(0.08);
  });

  // Taux × prime nette : 6 CV taxi, 5 places → 128 938 + Individuelle Conducteur 1 000 = 129 938.
  it.each([
    [0.09, 11694],
    [0.1, 12994],
    [0.085, 11045],
    [0, 0],
  ])("applique la commission saisie (%s)", (tauxCommission, attendu) => {
    const r = computeTarif({
      categorie: "CAT_04_TPV",
      puissance: 6,
      places: 5,
      dureeMois: 12,
      frais: 2000,
      tauxCommission,
    });
    expect(r.tauxCommission).toBe(tauxCommission);
    expect(r.commission).toBe(attendu);
    expect(r.netAVerser).toBe(r.primeTotale - r.frais - attendu);
    // Le taux ne touche ni la prime ni les taxes.
    expect(r.primeTotale).toBe(tpv(6, 5).primeTotale);
  });

  it.each([-0.01, 1.5, Number.NaN, 0.0825])("refuse la commission %s", (tauxCommission) => {
    expect(() =>
      computeTarif({
        categorie: "CAT_04_TPV",
        puissance: 6,
        places: 5,
        dureeMois: 12,
        frais: 2000,
        tauxCommission,
      }),
    ).toThrow(/Commission invalide/);
  });

  it.each([3, 0, 4.5])("refuse %s places", (places) => {
    expect(() => tpv(6, places)).toThrow(TarifError);
  });

  it("refuse une puissance sous le barème", () => {
    expect(() => tpv(1, 5)).toThrow(/1 CV/);
  });
});
