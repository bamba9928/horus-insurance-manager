/**
 * Schémas Zod pour la validation des véhicules.
 *
 * @module schemas/vehicule
 */

import { z } from "zod/v4";

/** Genres de véhicules autorisés */
export const GENRES_VEHICULE = ["VP", "VP/CI", "TPV", "TPC", "TPM", "MOTO"] as const;

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
