/**
 * Proxy de verification d'un contrat auprès de l'API AAS.
 * Le handler est partagé entre la route publique et la route authentifiée
 * historique afin de conserver exactement les mêmes validations.
 */

import type { Context } from "hono";
import { z } from "zod";

const verifyParamSchema = z.string().min(1).max(20);

const verificationDataSchema = z.object({
  attestationNumber: z.string(),
  dateVerification: z.string(),
  immatriculation: z.string(),
  dateEffet: z.string(),
  dateEcheance: z.string(),
  marque: z.string(),
  modele: z.string(),
});

const verificationResponseSchema = z.object({
  operationStatus: z.enum(["SUCCESS", "ERROR"]),
  operationMessage: z.string(),
  data: verificationDataSchema.nullable(),
});

const attestationParamSchema = z.string().regex(/^[A-Za-z0-9]{1,20}$/);

const optionalString = z.string().nullish();
const optionalNumber = z.number().nullish();

/**
 * Sous-ensemble utile de la souscription AAS. Les champs techniques
 * (secureKey, qrCodeValue, identifiants internes, arborescence de la
 * compagnie) sont volontairement écartés : zod retire les clés non déclarées.
 */
const souscriptionDataSchema = z.object({
  attestationNumber: z.string(),
  police: optionalString,
  dateSouscription: optionalString,
  assure: z
    .object({
      immatriculation: optionalString,
      marque: optionalString,
      modele: optionalString,
      category: optionalString,
      carburant: optionalString,
      puissanceFiscale: optionalNumber,
      nombrePlace: optionalNumber,
      dateMiseCirculation: optionalString,
      valeurNeuve: optionalNumber,
      valeurActuelle: optionalNumber,
      vin: optionalString,
    })
    .nullish(),
  periodeCouverture: z
    .object({
      dateEffet: optionalString,
      dateExpiration: optionalString,
      duree: optionalNumber,
    })
    .nullish(),
  beneficiaire: z
    .object({
      nom: optionalString,
      prenom: optionalString,
      cellulaire: optionalString,
      email: optionalString,
      adresse: optionalString,
    })
    .nullish(),
  contact: z
    .object({
      cellulaire: optionalString,
      email: optionalString,
      adresse: optionalString,
      fixe: optionalString,
    })
    .nullish(),
  compagnie: z.object({ libelle: optionalString }).nullish(),
});

const souscriptionResponseSchema = z.object({
  operationStatus: z.enum(["SUCCESS", "ERROR"]),
  operationMessage: z.string(),
  data: souscriptionDataSchema.nullable(),
});

const AAS_TIMEOUT_MS = 15_000;

/** Appelle l'API AAS et ne relaie que les réponses conformes à `schema`. */
async function proxyAas(c: Context, url: string, schema: z.ZodType): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AAS_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { signal: controller.signal });
    if (!upstream.ok) {
      return c.json({ error: `Erreur API : HTTP ${upstream.status}` }, 502);
    }

    const body = await upstream.json().catch(() => null);
    const validated = schema.safeParse(body);
    if (!validated.success) {
      return c.json({ error: "Réponse API invalide" }, 502);
    }

    return c.json(validated.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    return c.json({ error: `Erreur réseau : ${message}` }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function verificationHandler(c: Context): Promise<Response> {
  const parsed = verifyParamSchema.safeParse(c.req.param("immatriculation"));
  if (!parsed.success) return c.json({ error: "Immatriculation invalide" }, 400);

  const normalized = parsed.data.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!normalized) return c.json({ error: "Immatriculation invalide" }, 400);

  return proxyAas(
    c,
    `https://apiaas.diotali.com/applicationtiers/verify/${normalized}`,
    verificationResponseSchema,
  );
}

/**
 * Détail de la souscription liée à une attestation. Contient des données
 * personnelles de l'assuré : à monter uniquement derrière une authentification.
 */
export async function souscriptionHandler(c: Context): Promise<Response> {
  const parsed = attestationParamSchema.safeParse(c.req.param("attestationNumber"));
  if (!parsed.success) return c.json({ error: "Numéro d'attestation invalide" }, 400);

  return proxyAas(
    c,
    `https://apiaas.diotali.com/souscriptionauto/souscription-by-attestation-number/${parsed.data.toUpperCase()}`,
    souscriptionResponseSchema,
  );
}
