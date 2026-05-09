/**
 * Schémas Zod pour la validation des assureurs.
 *
 * @module schemas/assureur
 */

import { z } from "zod/v4";

export const INTEGRATION_TYPES = ["MANUAL", "MOCK", "API"] as const;

/** Schéma de création d'un assureur */
export const assureurCreateSchema = z.object({
  nom: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(200, "Le nom ne peut pas dépasser 200 caractères"),
  contact: z.string().max(200).optional(),
  adresse: z.string().max(500).optional(),
  code: z.string().max(50).optional(),
  integrationType: z.enum(INTEGRATION_TYPES).optional(),
  apiBaseUrl: z.string().max(500).optional(),
  portalUrl: z.string().max(500).optional(),
  technicalContact: z.string().max(200).optional(),
  integrationEnabled: z.boolean().optional(),
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
  code: z.string().nullable(),
  integration_type: z.enum(INTEGRATION_TYPES).nullable(),
  api_base_url: z.string().nullable(),
  portal_url: z.string().nullable(),
  technical_contact: z.string().nullable(),
  integration_enabled: z.number().nullable(),
  last_connection_status: z.string().nullable(),
  last_connection_at: z.string().nullable(),
});

/** Type d'un assureur en DB */
export type Assureur = z.infer<typeof assureurSchema>;

/** Type pour créer un assureur */
export type AssureurCreate = z.infer<typeof assureurCreateSchema>;

/** Type pour modifier un assureur */
export type AssureurUpdate = z.infer<typeof assureurUpdateSchema>;
