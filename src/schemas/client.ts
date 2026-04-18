/**
 * Schémas Zod pour la validation des clients.
 * Source de vérité pour les types côté frontend.
 *
 * @module schemas/client
 */

import { z } from "zod/v4";

/** Schéma de création d'un client */
export const clientCreateSchema = z.object({
  nomPrenom: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(200, "Le nom ne peut pas dépasser 200 caractères"),
  adresse: z.string().max(500).optional(),
  telephone: z
    .string()
    .regex(
      /^(\+221)?[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}$/,
      "Format téléphone invalide (ex: 77 123 45 67)",
    )
    .optional(),
  email: z.email("Email invalide").optional(),
  notes: z.string().max(2000).optional(),
});

/** Schéma de mise à jour d'un client */
export const clientUpdateSchema = clientCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/** Schéma d'un client en DB (lecture) */
export const clientSchema = z.object({
  id: z.number().int().positive(),
  nom_prenom: z.string(),
  adresse: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

/** Type d'un client en DB */
export type Client = z.infer<typeof clientSchema>;

/** Type pour créer un client */
export type ClientCreate = z.infer<typeof clientCreateSchema>;

/** Type pour modifier un client */
export type ClientUpdate = z.infer<typeof clientUpdateSchema>;
