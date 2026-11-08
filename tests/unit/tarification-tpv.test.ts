import { describe, expect, it } from "vitest";
import { computeTarif, TarifError } from "../../src/lib/tarification";

const tpv = (puissance: number, places: number, dureeMois = 12, frais = 2000) =>
  computeTarif({ categorie: "CAT_04_TPV", puissance, places, dureeMois, frais });

/** Une puissance par ligne de la grille : 2 | 2 à 4 | 5 à 7 | 8 à 10 | 11 à 16 | 17 et plus. */
const LIGNES_CV = [2, 3, 6, 9, 13, 18];

/** RC annuel relevé dans TARIFICATION.xlsx, par nombre de places puis ligne de puissance. */
const GRILLE_RC: [places: number, rc: number[]][] = [
  [4, [113109, 128938, 145960, 196133, 252483, 290205]],
  [5, [113109, 128938, 145960, 196133, 252483, 290205]],
  [6, [158800, 174629, 191651, 241824, 298174, 335896]],
  [7, [183288, 199117, 216139, 266312, 322662, 360384]],
  [8, [216138, 231967, 248989, 299162, 355512, 393234]],
  [9, [273036, 288865, 305887, 356060, 412410, 450132]],
  [15, [273036, 288865, 305887, 356060, 412410, 450132]],
  [20, [273036, 288865, 305887, 356060, 412410, 450132]],
  [25, [310696, 326525, 343547, 393720, 450070, 487792]],
  [32, [373912, 389741, 406763, 456936, 513286, 551008]],
  [35, [394090, 409919, 426941, 477114, 533464, 571186]],
  [40, [427720, 443549, 460571, 510744, 567094, 604816]],
  [42, [441172, 457001, 474023, 524196, 580546, 618268]],
  [60, [562240, 578069, 595091, 645264, 701614, 739336]],
];

describe("TPV — grille RC annuelle du courtier", () => {
  it.each(GRILLE_RC)("%i places", (places, attendus) => {
    expect(LIGNES_CV.map((cv) => tpv(cv, places).rcAnnuel)).toEqual(attendus);
  });

  it("le forfait minicar rejoint le calcul par passager à 21 places", () => {
    expect(tpv(9, 21).rcAnnuel).toBe(tpv(9, 20).rcAnnuel);
    expect(tpv(9, 22).rcAnnuel).toBe(tpv(9, 21).rcAnnuel + 9415);
  });

  it("sépare 2 CV de la tranche 3 à 4 CV", () => {
    expect(tpv(2, 5).rcAnnuel).toBe(84736 + 28373);
    expect(tpv(4, 5).rcAnnuel).toBe(100565 + 28373);
  });
});

describe("TPV — décompte par durée (frais 2000)", () => {
  it("taxi urbain 5 à 7 CV, 1 mois", () => {
    const r = tpv(6, 5, 1);
    expect(r.rCivil).toBe(12772);
    expect(r.primeNette).toBe(13772);
    expect(r.taxe).toBe(2208);
    expect(r.fga).toBe(319);
    expect(r.primeTotale).toBe(18599);
  });

  it("minicar 8 à 10 CV, 6 mois", () => {
    const r = tpv(9, 15, 6);
    expect(r.rCivil).toBe(186932);
    expect(r.primeNette).toBe(187932);
    expect(r.taxe).toBe(26590);
    expect(r.fga).toBe(4673);
    expect(r.primeTotale).toBe(221495);
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
  it("rejoue le décompte d'une simulation Pool à partir de sa prime RC", () => {
    const r = computeTarif({
      categorie: "CAT_04_TPV",
      puissance: 12,
      places: 15,
      dureeMois: 1,
      frais: 2000,
      rcProrataAss: 36084,
    });
    expect(r.primeNette).toBe(37084);
    expect(r.taxe).toBe(5472);
    expect(r.fga).toBe(902);
    expect(r.carteBrune).toBe(300);
    expect(r.primeTotale).toBe(45758);
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

  it("calcule la commission sur la RC seule", () => {
    const r = tpv(6, 5);
    expect(r.commission).toBe(11677);
    expect(r.netAVerser).toBe(r.primeTotale - r.frais - r.commission);
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

  it.each([3, 0, 4.5])("refuse %s places", (places) => {
    expect(() => tpv(6, places)).toThrow(TarifError);
  });

  it("refuse une puissance sous le barème", () => {
    expect(() => tpv(1, 5)).toThrow(/1 CV/);
  });
});
