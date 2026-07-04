/**
 * Schémas Zod de validation des entrées de l'API métier.
 * Le serveur est la frontière de confiance : il revalide tout, même si le
 * frontend a déjà validé. Miroir de src/schemas/*.ts (desktop).
 *
 * @module schemas
 */

import { z } from "zod";

// ============ CLIENTS ============

export const clientCreateSchema = z.object({
  nomPrenom: z.string().min(2).max(200),
  adresse: z.string().max(500).optional(),
  telephone: z.string().max(50).optional(),
  email: z.string().email().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

// ============ VÉHICULES ============

const REGEX_IMMATRICULATION = /^[A-Z]{2}\s?\d{3,4}\s?[A-Z]{1,3}$/i;

export const vehiculeCreateSchema = z.object({
  clientId: z.number().int().positive(),
  immatriculation: z
    .string()
    .regex(REGEX_IMMATRICULATION)
    .transform((v) => v.toUpperCase().replace(/\s+/g, " ").trim()),
  marque: z.string().max(100).optional(),
  modele: z.string().max(100).optional(),
  genre: z.string().max(50).optional(),
  typeVehicule: z.string().max(100).optional(),
  puissance: z.number().int().min(1).max(1000).optional(),
  places: z.number().int().min(1).max(100).optional(),
});

export const vehiculeUpdateSchema = vehiculeCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

// ============ ASSUREURS ============

const INTEGRATION_TYPES = ["MANUAL", "MOCK", "API"] as const;

export const assureurCreateSchema = z.object({
  nom: z.string().min(1).max(200),
  contact: z.string().max(200).optional(),
  adresse: z.string().max(500).optional(),
  code: z.string().max(50).optional(),
  integrationType: z.enum(INTEGRATION_TYPES).optional(),
  apiBaseUrl: z.string().max(500).optional(),
  portalUrl: z.string().max(500).optional(),
  technicalContact: z.string().max(200).optional(),
  integrationEnabled: z.boolean().optional(),
});

export const assureurUpdateSchema = assureurCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

// ============ POLICES ============

const TYPES_CARTE = ["VERTE", "JAUNE"] as const;
const DUREES_MOIS = [1, 3, 6, 9, 12, 24] as const;
const STATUTS_POLICE = ["ACTIVE", "EXPIRÉE", "ANNULÉE", "RENOUVELÉE"] as const;
const STATUTS_INTEGRATION = ["LOCAL", "PENDING", "SYNCED", "ERROR"] as const;

export const policeCreateSchema = z.object({
  vehiculeId: z.number().int().positive(),
  assureurId: z.number().int().positive().optional(),
  numeroPolice: z.string().max(100).optional(),
  typeCarte: z.enum(TYPES_CARTE),
  dateEffet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dureeMois: z
    .number()
    .int()
    .refine((v) => (DUREES_MOIS as readonly number[]).includes(v)),
  appreciation: z.string().max(2000).optional(),
  externalReference: z.string().max(200).optional(),
  integrationStatus: z.enum(STATUTS_INTEGRATION).optional(),
  syncError: z.string().max(1000).optional(),
});

export const policeUpdateSchema = policeCreateSchema.partial().extend({
  id: z.number().int().positive(),
  statut: z.enum(STATUTS_POLICE).optional(),
});

// ============ PAIEMENTS ============

const MODES_PAIEMENT = ["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"] as const;

export const paiementCreateSchema = z.object({
  policeId: z.number().int().positive(),
  montantDu: z.number().int().min(0),
  paye: z.number().int().min(0).default(0),
  avance: z.number().int().min(0).default(0),
  datePaiement: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  mode: z.enum(MODES_PAIEMENT).optional(),
  reference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const paiementUpdateSchema = paiementCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

// ============ DOSSIER COMPLET ============

const dossierVehiculeSchema = vehiculeCreateSchema.omit({ clientId: true });
const dossierPoliceSchema = policeCreateSchema.omit({ vehiculeId: true });
const dossierPaiementSchema = paiementCreateSchema.omit({ policeId: true });

export const dossierCreateSchema = z.object({
  client: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existant"), clientId: z.number().int().positive() }),
    z.object({ mode: z.literal("nouveau"), data: clientCreateSchema }),
  ]),
  vehicule: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existant"), vehiculeId: z.number().int().positive() }),
    z.object({ mode: z.literal("nouveau"), data: dossierVehiculeSchema }),
  ]),
  police: dossierPoliceSchema,
  paiement: dossierPaiementSchema.optional(),
});

// ============ LISTES / FILTRES ============

export const listClientsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100_000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  orderBy: z.enum(["nom_prenom", "created_at", "telephone", "email"]).optional(),
  orderDir: z.enum(["ASC", "DESC"]).optional(),
});

export const listPolicesQuerySchema = z.object({
  vehiculeId: z.coerce.number().int().positive().optional(),
  statut: z.enum(STATUTS_POLICE).optional(),
  typeCarte: z.enum(TYPES_CARTE).optional(),
});

export const echeancesRangeQuerySchema = z.object({
  fromDays: z.coerce.number().int().optional(),
  toDays: z.coerce.number().int().optional(),
  expiredOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
export type VehiculeCreateInput = z.infer<typeof vehiculeCreateSchema>;
export type VehiculeUpdateInput = z.infer<typeof vehiculeUpdateSchema>;
export type AssureurCreateInput = z.infer<typeof assureurCreateSchema>;
export type AssureurUpdateInput = z.infer<typeof assureurUpdateSchema>;
export type PoliceCreateInput = z.infer<typeof policeCreateSchema>;
export type PoliceUpdateInput = z.infer<typeof policeUpdateSchema>;
export type PaiementCreateInput = z.infer<typeof paiementCreateSchema>;
export type PaiementUpdateInput = z.infer<typeof paiementUpdateSchema>;
export type DossierCreateInput = z.infer<typeof dossierCreateSchema>;
