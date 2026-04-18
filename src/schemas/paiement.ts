/**
 * Schémas Zod pour la validation des paiements.
 *
 * @module schemas/paiement
 */

import { z } from "zod/v4";

/** Modes de paiement autorisés */
export const MODES_PAIEMENT = ["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"] as const;

/** Schéma de création d'un paiement */
export const paiementCreateSchema = z.object({
  policeId: z.number().int().positive("Police requise"),
  montantDu: z.number().int().min(0, "Le montant ne peut pas être négatif"),
  paye: z.number().int().min(0).default(0),
  avance: z.number().int().min(0).default(0),
  datePaiement: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)")
    .optional(),
  mode: z.enum(MODES_PAIEMENT).optional(),
  reference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

/** Schéma de mise à jour d'un paiement */
export const paiementUpdateSchema = paiementCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/** Schéma d'un paiement en DB */
export const paiementSchema = z.object({
  id: z.number().int().positive(),
  police_id: z.number().int().positive(),
  montant_du: z.number().int(),
  paye: z.number().int(),
  avance: z.number().int(),
  reste: z.number().int().nullable(),
  date_paiement: z.string().nullable(),
  mode: z.string().nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
});

/** Type d'un paiement en DB */
export type Paiement = z.infer<typeof paiementSchema>;

/** Type pour créer un paiement */
export type PaiementCreate = z.infer<typeof paiementCreateSchema>;

/** Type pour modifier un paiement */
export type PaiementUpdate = z.infer<typeof paiementUpdateSchema>;

/**
 * Statut de paiement déduit du montant restant.
 */
export type PaiementStatut = "SOLDE" | "PARTIEL" | "IMPAYE";

/**
 * Détermine le statut d'un paiement.
 */
export function getPaiementStatut(reste: number, montantDu: number): PaiementStatut {
  if (reste <= 0) return "SOLDE";
  if (reste < montantDu) return "PARTIEL";
  return "IMPAYE";
}
