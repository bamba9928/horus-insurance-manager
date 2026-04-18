/**
 * Schémas Zod pour la validation des assureurs.
 *
 * @module schemas/assureur
 */

import { z } from "zod/v4";

/** Schéma de création d'un assureur */
export const assureurCreateSchema = z.object({
  nom: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(200, "Le nom ne peut pas dépasser 200 caractères"),
  contact: z.string().max(200).optional(),
  adresse: z.string().max(500).optional(),
});

/** Schéma de mise à jour d'un assureur */
export const assureurUpdateSchema = assureurCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/** Schéma d'un assureur en DB */
export const assureurSchema = z.object({
  id: z.number().int().positive(),
  nom: z.string(),
  contact: z.string().nullable(),
  adresse: z.string().nullable(),
});

/** Type d'un assureur en DB */
export type Assureur = z.infer<typeof assureurSchema>;

/** Type pour créer un assureur */
export type AssureurCreate = z.infer<typeof assureurCreateSchema>;

/** Type pour modifier un assureur */
export type AssureurUpdate = z.infer<typeof assureurUpdateSchema>;
