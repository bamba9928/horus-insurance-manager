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

/** Retrouve le libellé complet d'une catégorie à partir de son code. */
export function getCategorieLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return CATEGORIES_VEHICULE.find((c) => c.value === code)?.label ?? code;
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
