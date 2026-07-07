import { describe, expect, it } from "vitest";
import {
  buildWhatsAppDevisUrl,
  computeDevisRapide,
  DEVIS_WHATSAPP_PHONE,
  getDevisCommercialParams,
} from "../../src/lib/devis";
import { computeTarif } from "../../src/lib/tarification";

describe("computeDevisRapide", () => {
  it("applique 30% de réduction et 3000 FCFA de frais sur les TPC", () => {
    const devis = computeDevisRapide({
      genre: "CAT_02_TPC_LT3T5_FGTTE",
      puissance: 7,
      dureeMois: 12,
    });
    const reference = computeTarif({
      categorie: "CAT_02_TPC_LT3T5_FGTTE",
      puissance: 7,
      dureeMois: 12,
      frais: 3000,
      bonus: 0.3,
    });

    expect(devis.bonus).toBe(0.3);
    expect(devis.frais).toBe(3000);
    expect(devis.tarif.primeTotale).toBe(reference.primeTotale);
    expect(devis.aPayer).toBe(reference.primeTotale);
  });

  it("diminue 2000 FCFA sur l'à payer hors TPC au-delà de 3 mois", () => {
    const devis = computeDevisRapide({
      genre: "CAT_01_VP",
      puissance: 7,
      dureeMois: 12,
    });

    expect(devis.remiseAPayer).toBe(2000);
    expect(devis.aPayer).toBe(devis.tarif.primeTotale - 2000);
  });

  it("ne diminue pas 2000 FCFA hors TPC pour 3 mois ou moins", () => {
    const devis = computeDevisRapide({
      genre: "CAT_01_VP",
      puissance: 7,
      dureeMois: 3,
    });

    expect(devis.remiseAPayer).toBe(0);
    expect(devis.aPayer).toBe(devis.tarif.primeTotale);
  });
});

describe("getDevisCommercialParams", () => {
  it("n'applique pas la remise hors TPC aux catégories TPC", () => {
    const params = getDevisCommercialParams("CAT_02_TPC_GT3T5", 12);

    expect(params.isTpc).toBe(true);
    expect(params.remiseAPayer).toBe(0);
  });
});

describe("buildWhatsAppDevisUrl", () => {
  it("prépare un lien WhatsApp avec les détails du devis", () => {
    const url = buildWhatsAppDevisUrl({
      categorieLabel: "CAT 01 : Véhicule Particulier (VP)",
      genreLabel: "CAT 01 — Véhicule Particulier (VP)",
      puissance: 7,
      dureeMois: 12,
      aPayer: 49325,
    });

    expect(url.startsWith(`https://wa.me/${DEVIS_WHATSAPP_PHONE}?text=`)).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1] ?? "");
    expect(text).toContain("valider ce devis");
    expect(text).toContain("Puissance : 7 CV");
    expect(text).toContain("À payer : 49 325 FCFA");
  });
});
