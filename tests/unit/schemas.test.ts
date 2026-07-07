import { describe, expect, it } from "vitest";
import { clientCreateSchema } from "../../src/schemas/client";
import { getPaiementStatut, paiementCreateSchema } from "../../src/schemas/paiement";
import { policeCreateSchema } from "../../src/schemas/police";
import { getSousCategoriesByCategorie, vehiculeCreateSchema } from "../../src/schemas/vehicule";

describe("clientCreateSchema", () => {
  it("accepte un client valide minimal", () => {
    const result = clientCreateSchema.safeParse({ nomPrenom: "Mamadou Diallo" });
    expect(result.success).toBe(true);
  });

  it("accepte un client valide complet", () => {
    const result = clientCreateSchema.safeParse({
      nomPrenom: "Mamadou Diallo",
      telephone: "77 123 45 67",
      email: "mamadou@example.com",
      adresse: "Dakar, Sénégal",
      notes: "Client fidèle",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un nom trop court", () => {
    const result = clientCreateSchema.safeParse({ nomPrenom: "A" });
    expect(result.success).toBe(false);
  });

  it("rejette un nom manquant", () => {
    const result = clientCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepte un téléphone avec indicatif +221", () => {
    const result = clientCreateSchema.safeParse({
      nomPrenom: "Test",
      telephone: "+221 77 123 45 67",
    });
    expect(result.success).toBe(true);
  });

  it("accepte un téléphone commençant par 78", () => {
    const result = clientCreateSchema.safeParse({
      nomPrenom: "Test",
      telephone: "78 123 45 67",
    });
    expect(result.success).toBe(true);
  });
});

describe("vehiculeCreateSchema", () => {
  it("accepte un véhicule valide", () => {
    const result = vehiculeCreateSchema.safeParse({
      clientId: 1,
      immatriculation: "DK 1234 AB",
      genre: "CAT_01",
      typeVehicule: "Véhicule particulier",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une immatriculation invalide", () => {
    const result = vehiculeCreateSchema.safeParse({
      clientId: 1,
      immatriculation: "123-INVALID",
      genre: "CAT_01",
      typeVehicule: "Véhicule particulier",
    });
    expect(result.success).toBe(false);
  });

  it("transforme l'immatriculation en majuscules", () => {
    const result = vehiculeCreateSchema.safeParse({
      clientId: 1,
      immatriculation: "dk 1234 ab",
      genre: "CAT_01",
      typeVehicule: "Véhicule particulier",
    });
    if (result.success) {
      expect(result.data.immatriculation).toBe("DK 1234 AB");
    }
  });

  it("rejette une catégorie ou un genre manquant", () => {
    const result = vehiculeCreateSchema.safeParse({
      clientId: 1,
      immatriculation: "DK 1234 AB",
    });
    expect(result.success).toBe(false);
  });
});

describe("getSousCategoriesByCategorie", () => {
  it("retourne les genres dépendants de la catégorie", () => {
    expect(getSousCategoriesByCategorie("CAT_02")).toEqual([
      "Utilitaire carrosserie tourisme",
      "Utilitaire autre carrosserie jusqu'à 3T500",
      "Utilitaire autre carrosserie au-delà de 3T500",
    ]);
  });

  it("retourne une liste vide pour une catégorie inconnue", () => {
    expect(getSousCategoriesByCategorie("UNKNOWN")).toEqual([]);
  });
});

describe("policeCreateSchema", () => {
  it("accepte une police valide", () => {
    const result = policeCreateSchema.safeParse({
      vehiculeId: 1,
      assureurId: 1,
      typeCarte: "VERTE",
      dateEffet: "2025-01-15",
      dureeMois: 12,
    });
    expect(result.success).toBe(true);
  });

  it("accepte les durées mensuelles de 1 à 12", () => {
    for (const dureeMois of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const result = policeCreateSchema.safeParse({
        vehiculeId: 1,
        assureurId: 1,
        typeCarte: "VERTE",
        dateEffet: "2025-01-15",
        dureeMois,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejette un type de carte invalide", () => {
    const result = policeCreateSchema.safeParse({
      vehiculeId: 1,
      assureurId: 1,
      typeCarte: "BLEUE",
      dateEffet: "2025-01-15",
      dureeMois: 12,
    });
    expect(result.success).toBe(false);
  });

  it("rejette une durée non autorisée", () => {
    const result = policeCreateSchema.safeParse({
      vehiculeId: 1,
      assureurId: 1,
      typeCarte: "VERTE",
      dateEffet: "2025-01-15",
      dureeMois: 13,
    });
    expect(result.success).toBe(false);
  });

  it("rejette un assureur manquant", () => {
    const result = policeCreateSchema.safeParse({
      vehiculeId: 1,
      typeCarte: "VERTE",
      dateEffet: "2025-01-15",
      dureeMois: 12,
    });
    expect(result.success).toBe(false);
  });
});

describe("getPaiementStatut", () => {
  it("accepte un paiement avec mode sans référence", () => {
    const result = paiementCreateSchema.safeParse({
      policeId: 1,
      montantDu: 100000,
      paye: 100000,
      avance: 0,
      mode: "ESPECES",
    });
    expect(result.success).toBe(true);
  });

  it("retourne SOLDE quand reste = 0", () => {
    expect(getPaiementStatut(0, 100000)).toBe("SOLDE");
  });

  it("retourne PARTIEL quand reste < montantDu", () => {
    expect(getPaiementStatut(50000, 100000)).toBe("PARTIEL");
  });

  it("retourne IMPAYE quand reste = montantDu", () => {
    expect(getPaiementStatut(100000, 100000)).toBe("IMPAYE");
  });
});
