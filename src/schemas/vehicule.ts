/**
 * Schémas Zod pour la validation des véhicules.
 *
 * @module schemas/vehicule
 */

import { z } from "zod/v4";

/**
 * Catégories de véhicules (nomenclature assurance auto Sénégal).
 * Le code est stocké en DB dans la colonne `genre` (conservée pour
 * compatibilité). Le libellé complet s'affiche dans l'UI.
 */
export const CATEGORIES_VEHICULE = [
  { value: "CAT_01", label: "CAT 01 : Véhicule Particulier (VP)" },
  { value: "CAT_02", label: "CAT 02 : Véhicules Utilitaires (TPC)" },
  { value: "CAT_03", label: "CAT 03 : Véhicules Transports (TPM)" },
  { value: "CAT_04", label: "CAT 04 : Véhicules utilisés pour Transports de Personnes (TPV)" },
  {
    value: "CAT_05",
    label:
      "CAT 05 : Véhicules motorisés à 2 roues ou 3 roues - Cyclomoteurs - Scooters et Vélomoteurs (2R)",
  },
  { value: "CAT_06", label: "CAT 06 : Garage Véhicule (C6-WG)" },
  {
    value: "CAT_07",
    label: "CAT 07 : Véhicule de Tourisme - Side-cars - Véhicules des catégories 2 et 3 (C7-AE)",
  },
  { value: "CAT_08", label: "CAT 08 : Véhicule de Location (C8-VLSC)" },
  {
    value: "CAT_09",
    label: "CAT 09 : Engins Mobiles de Chantier avec exclusions des accidents (C9-EM)",
  },
  {
    value: "CAT_10",
    label:
      "CAT 10 : Engins mobiles de chantiers - Tracteurs agricoles et routiers - Véhicules des collectivités publiques - Voitures",
  },
  {
    value: "BUS_ECOLE",
    label: "BUS ECOLE : Transport dans des camions aménagés pour le transport de personnes",
  },
  { value: "REMORQUE", label: "REMORQUE : Remorque" },
] as const;

/** Codes autorisés (tuple pour Zod enum) */
export const GENRES_VEHICULE = [
  "CAT_01",
  "CAT_02",
  "CAT_03",
  "CAT_04",
  "CAT_05",
  "CAT_06",
  "CAT_07",
  "CAT_08",
  "CAT_09",
  "CAT_10",
  "BUS_ECOLE",
  "REMORQUE",
] as const;

export type CategorieVehiculeCode = (typeof GENRES_VEHICULE)[number];

/**
 * Sous-catégories métier affichées sous le libellé "Genre".
 * Elles sont stockées en DB dans `type_vehicule` pour conserver le schéma
 * existant, mais elles dépendent de la catégorie sélectionnée (`genre`).
 */
export const SOUS_CATEGORIES_VEHICULE = {
  CAT_01: ["Véhicule particulier"],
  CAT_02: [
    "Utilitaire carrosserie tourisme",
    "Utilitaire autre carrosserie jusqu'à 3T500",
    "Utilitaire autre carrosserie au-delà de 3T500",
  ],
  CAT_03: ["Transport marchandises jusqu'à 3T500", "Transport marchandises au-delà de 3T500"],
  CAT_04: [
    "Transport personnes à titre onéreux 8 places au plus",
    "Transport personnes à titre onéreux 9 places et plus",
  ],
  CAT_05: [
    "Cyclomoteurs",
    "Scooters et vélomoteurs jusqu'à 125 cm3",
    "Motocyclettes et scooters de plus de 125 cm3",
    "Side-cars toutes cylindrées",
  ],
  CAT_06: ["Garage véhicule à 04 roues", "Garage atelier autre 02 ou 03 roues"],
  CAT_07: [
    "Side-cars sans double commande",
    "Véhicule de tourisme avec double commande",
    "Catégories 2 et 3 avec double commande",
    "Véhicule de tourisme sans double commande",
    "Catégories 2 et 3 sans double commande",
  ],
  CAT_08: [
    "Véhicule de location sans chauffeur",
    "Location sans chauffeur TPC",
    "Location sans chauffeur TPM moins de 3T500",
    "Location sans chauffeur TPM plus de 3T500",
  ],
  CAT_09: [
    "Engins mobiles de chantier avec exclusion des accidents",
    "Engins mobiles de chantier avec extension des accidents",
  ],
  CAT_10: [
    "Engins mobiles de chantier",
    "Engins mobiles de chantier de moins de 3T500",
    "Engins mobiles de chantier de plus de 3T500",
    "Tracteurs agricoles et routiers",
    "Tracteurs agricoles et routiers de moins de 3T500",
    "Tracteurs agricoles et routiers de plus de 3T500",
    "Ambulances, corbillards et fourgons funéraires",
    "Véhicules automobiles à moteur électrique",
    "Véhicules des collectivités publiques",
    "Collectivités publiques de moins de 3T500",
    "Collectivités publiques de plus de 3T500",
  ],
  BUS_ECOLE: ["Véhicule de transport dans des autocars", "Camions aménagés transport de personnes"],
  REMORQUE: ["Remorque"],
} as const satisfies Record<CategorieVehiculeCode, readonly string[]>;

/** Retrouve le libellé complet d'une catégorie à partir de son code. */
export function getCategorieLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return CATEGORIES_VEHICULE.find((c) => c.value === code)?.label ?? code;
}

/** Retrouve les sous-catégories / genres disponibles pour une catégorie. */
export function getSousCategoriesByCategorie(code: string | null | undefined): readonly string[] {
  if (!code || !(GENRES_VEHICULE as readonly string[]).includes(code)) return [];
  return SOUS_CATEGORIES_VEHICULE[code as CategorieVehiculeCode];
}

/** Regex immatriculation Sénégal */
export const REGEX_IMMATRICULATION = /^[A-Z]{2}\s?\d{3,4}\s?[A-Z]{1,3}$/;

/** Schéma de création d'un véhicule */
export const vehiculeCreateSchema = z.object({
  clientId: z.number().int().positive("Client requis"),
  immatriculation: z
    .string()
    .regex(REGEX_IMMATRICULATION, "Format immatriculation invalide (ex: DK 1234 AB)")
    .transform((v) => v.toUpperCase().replace(/\s+/g, " ").trim()),
  marque: z.string().max(100).optional(),
  modele: z.string().max(100).optional(),
  genre: z.enum(GENRES_VEHICULE).optional(),
  typeVehicule: z.string().max(100).optional(),
  puissance: z.number().int().min(1).max(1000).optional(),
  places: z.number().int().min(1).max(100).optional(),
});

/** Schéma de mise à jour d'un véhicule */
export const vehiculeUpdateSchema = vehiculeCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/** Schéma d'un véhicule en DB */
export const vehiculeSchema = z.object({
  id: z.number().int().positive(),
  client_id: z.number().int().positive(),
  immatriculation: z.string(),
  marque: z.string().nullable(),
  modele: z.string().nullable(),
  genre: z.string().nullable(),
  type_vehicule: z.string().nullable(),
  puissance: z.number().nullable(),
  places: z.number().nullable(),
  created_at: z.string().nullable(),
});

/** Type d'un véhicule en DB */
export type Vehicule = z.infer<typeof vehiculeSchema>;

/** Type pour créer un véhicule */
export type VehiculeCreate = z.infer<typeof vehiculeCreateSchema>;

/** Type pour modifier un véhicule */
export type VehiculeUpdate = z.infer<typeof vehiculeUpdateSchema>;
