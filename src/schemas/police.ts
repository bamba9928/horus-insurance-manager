/**
 * Schémas Zod pour la validation des polices d'assurance.
 *
 * @module schemas/police
 */

import { z } from "zod/v4";

/** Types de carte autorisés */
export const TYPES_CARTE = ["VERTE", "JAUNE"] as const;

/** Durées en mois proposées pour les nouvelles polices */
export const DUREES_MOIS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
type DureeMois = (typeof DUREES_MOIS)[number];

/** Statuts de police */
export const STATUTS_POLICE = ["ACTIVE", "EXPIRÉE", "ANNULÉE", "RENOUVELÉE"] as const;
export const STATUTS_INTEGRATION_POLICE = ["LOCAL", "PENDING", "SYNCED", "ERROR"] as const;

/** Schéma de création d'une police */
export const policeCreateSchema = z.object({
  vehiculeId: z.number().int().positive("Véhicule requis"),
  assureurId: z.number("Assureur requis").int().positive("Assureur requis"),
  numeroPolice: z.string().max(100).optional(),
  typeCarte: z.enum(TYPES_CARTE),
  dateEffet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)"),
  dureeMois: z
    .number("Durée requise")
    .int()
    .refine(
      (v): v is DureeMois => (DUREES_MOIS as readonly number[]).includes(v),
      "Durée invalide. Valeurs acceptées : 1 à 12 mois",
    ),
  appreciation: z.string().max(2000).optional(),
  externalReference: z.string().max(200).optional(),
  integrationStatus: z.enum(STATUTS_INTEGRATION_POLICE).optional(),
  syncError: z.string().max(1000).optional(),
});

/** Schéma de mise à jour d'une police */
export const policeUpdateSchema = policeCreateSchema.partial().extend({
  id: z.number().int().positive(),
  statut: z.enum(STATUTS_POLICE).optional(),
});

/** Schéma d'une police en DB */
export const policeSchema = z.object({
  id: z.number().int().positive(),
  vehicule_id: z.number().int().positive(),
  assureur_id: z.number().nullable(),
  numero_police: z.string().nullable(),
  type_carte: z.enum(TYPES_CARTE),
  date_effet: z.string(),
  duree_mois: z.number().int(),
  date_echeance: z.string().nullable(),
  appreciation: z.string().nullable(),
  statut: z.string().nullable(),
  external_reference: z.string().nullable(),
  integration_status: z.enum(STATUTS_INTEGRATION_POLICE).nullable(),
  last_sync_at: z.string().nullable(),
  sync_error: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

/** Type d'une police en DB */
export type Police = z.infer<typeof policeSchema>;

/** Type pour créer une police */
export type PoliceCreate = z.infer<typeof policeCreateSchema>;

/** Type pour modifier une police */
export type PoliceUpdate = z.infer<typeof policeUpdateSchema>;
