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

const VERIFY_TIMEOUT_MS = 15_000;

export async function verificationHandler(c: Context): Promise<Response> {
  const parsed = verifyParamSchema.safeParse(c.req.param("immatriculation"));
  if (!parsed.success) return c.json({ error: "Immatriculation invalide" }, 400);

  const normalized = parsed.data.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!normalized) return c.json({ error: "Immatriculation invalide" }, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const upstream = await fetch(
      `https://apiaas.diotali.com/applicationtiers/verify/${normalized}`,
      { signal: controller.signal },
    );
    if (!upstream.ok) {
      return c.json({ error: `Erreur API : HTTP ${upstream.status}` }, 502);
    }

    const body = await upstream.json().catch(() => null);
    const validated = verificationResponseSchema.safeParse(body);
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
