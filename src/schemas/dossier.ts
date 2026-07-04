/**
 * Schémas Zod pour le dossier complet (client + véhicule + police + paiement).
 * Chaque étape de l'assistant valide son propre sous-schéma ; l'ensemble
 * est enregistré en une seule transaction via `createDossier`.
 *
 * @module schemas/dossier
 */

import type { z } from "zod/v4";
import type { ClientCreate } from "./client";
import { paiementCreateSchema } from "./paiement";
import { policeCreateSchema } from "./police";
import { vehiculeCreateSchema } from "./vehicule";

/** Véhicule saisi dans l'assistant : le client est résolu par le dossier. */
export const dossierVehiculeSchema = vehiculeCreateSchema.omit({ clientId: true });

/** Police saisie dans l'assistant : le véhicule est résolu par le dossier. */
export const dossierPoliceSchema = policeCreateSchema.omit({ vehiculeId: true });

/** Paiement saisi dans l'assistant : la police est résolue par le dossier. */
export const dossierPaiementSchema = paiementCreateSchema.omit({ policeId: true });

export type DossierVehicule = z.infer<typeof dossierVehiculeSchema>;
export type DossierPolice = z.infer<typeof dossierPoliceSchema>;
export type DossierPaiement = z.infer<typeof dossierPaiementSchema>;

/** Étape client : réutiliser un client existant ou en créer un nouveau. */
export type DossierClientStep =
  | { mode: "existant"; clientId: number }
  | { mode: "nouveau"; data: ClientCreate };

/** Étape véhicule : réutiliser un véhicule existant ou en créer un nouveau. */
export type DossierVehiculeStep =
  | { mode: "existant"; vehiculeId: number }
  | { mode: "nouveau"; data: DossierVehicule };

/** Dossier complet à enregistrer en une transaction. */
export interface DossierCreate {
  client: DossierClientStep;
  vehicule: DossierVehiculeStep;
  police: DossierPolice;
  /** Optionnel : l'utilisateur peut différer l'enregistrement du paiement. */
  paiement?: DossierPaiement;
}

/** IDs créés (ou réutilisés) par l'enregistrement du dossier. */
export interface DossierCreated {
  clientId: number;
  vehiculeId: number;
  policeId: number;
  paiementId: number | null;
}
