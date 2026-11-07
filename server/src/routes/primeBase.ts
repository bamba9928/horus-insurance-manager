/**
 * Prime de base RÉELLE d'ASS, lue via Horus Assurances Digital.
 *
 * Le barème local (`src/lib/tarification-bareme.ts`) est une copie des tables
 * ASS : il dérive dès qu'ASS les change. Horus, lui, interroge l'API ASS en
 * direct. On ne lui demande que la PRIME DE BASE (RC au prorata, avant
 * réduction) : réduction, frais, taxe et FGA restent les règles du guichet,
 * appliquées côté client.
 *
 * Authentification : clé API partenaire Horus (`HORUS_API_KEY`), qui n'ouvre
 * que la simulation de tarification. Sans clé, la route répond 503
 * `not_configured` et l'interface garde le barème local.
 *
 * Non couverts par la simulation Horus (réponse 422 `unsupported`) : TPV
 * (taxis, autocars) et durées en jours.
 *
 * @module routes/primeBase
 */

import type { Context } from "hono";
import { z } from "zod";
import type { ServerEnv } from "../env.js";

const HORUS_TIMEOUT_MS = 15_000;

/** Genre ASS (code Horus) par catégorie du barème local. */
const GENRES: Record<string, string> = {
  CAT_01_VP: "VP",
  CAT_02_TPC_LT3T5_FGTTE: "TPC",
  CAT_02_TPC_LT3T5_CAMIONNETTE: "TPC3T500",
  CAT_02_TPC_GT3T5: "TPC3T500P",
  CAT_03_TPM_LT3T5: "TPM3T500",
  CAT_03_TPM_GT3T5: "TPM3T500P",
};

/** Deux-roues : genre ASS et cylindrée représentative (RC forfaitaire par genre). */
const DEUX_ROUES: Record<string, { genre: string; cylindree: number }> = {
  CYCLOMOTEUR: { genre: "2RCYC", cylindree: 49 },
  LT_125: { genre: "2RSCO", cylindree: 125 },
  GT_125: { genre: "2RMOT", cylindree: 250 },
  SIDE_CAR: { genre: "2RSID", cylindree: 250 },
};

export const primeBaseInputSchema = z.object({
  categorie: z.string().min(1).max(40),
  puissance: z.number().int().positive().max(500).optional(),
  cylindree: z.enum(["CYCLOMOTEUR", "LT_125", "GT_125", "SIDE_CAR"]).optional(),
  dureeMois: z.number().int().min(1).max(12),
});

export type PrimeBaseInput = z.infer<typeof primeBaseInputSchema>;

export interface HorusTarificationPayload {
  subcategory: string;
  duration: number;
  fiscal_power?: number;
  cylindree?: number;
}

/** Traduit la demande en simulation Horus ; `null` si ASS ne la tarife pas en ligne. */
export function toHorusPayload(input: PrimeBaseInput): HorusTarificationPayload | null {
  if (input.categorie === "CAT_05_2R" || input.categorie === "TRICYCLE") {
    const deuxRoues =
      DEUX_ROUES[input.categorie === "TRICYCLE" ? "SIDE_CAR" : (input.cylindree ?? "")];
    if (!deuxRoues) return null;
    return {
      subcategory: deuxRoues.genre,
      duration: input.dureeMois,
      cylindree: deuxRoues.cylindree,
    };
  }
  const genre = GENRES[input.categorie];
  if (!genre || input.puissance == null) return null;
  return { subcategory: genre, duration: input.dureeMois, fiscal_power: input.puissance };
}

const horusResponseSchema = z.object({
  decompte_client: z
    .object({
      prime_base: z.number(),
      reduction: z.number(),
      prime_rc: z.number(),
    })
    .nullable()
    .optional(),
});

export function primeBaseHandler(env: Pick<ServerEnv, "horusApiUrl" | "horusApiKey">) {
  return async (c: Context): Promise<Response> => {
    if (!env.horusApiKey) {
      return c.json(
        { error: "Tarification ASS en direct non configurée", code: "not_configured" },
        503,
      );
    }
    const parsed = primeBaseInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Paramètres de tarification invalides" }, 400);

    const payload = toHorusPayload(parsed.data);
    if (!payload) {
      return c.json({ error: "Catégorie non tarifée en ligne par ASS", code: "unsupported" }, 422);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HORUS_TIMEOUT_MS);
    try {
      const upstream = await fetch(`${env.horusApiUrl}/contracts/tarification/`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Api-Key ${env.horusApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        const detail =
          body && typeof body === "object" && "detail" in body
            ? String(body.detail)
            : `HTTP ${upstream.status}`;
        return c.json({ error: `Horus : ${detail}` }, 502);
      }
      const validated = horusResponseSchema.safeParse(body);
      const primeBase = validated.success ? validated.data.decompte_client?.prime_base : undefined;
      if (!primeBase || !Number.isInteger(primeBase) || primeBase <= 0) {
        return c.json({ error: "Réponse Horus sans prime de base exploitable" }, 502);
      }
      return c.json({ primeBase, genre: payload.subcategory, source: "ASS" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur réseau";
      return c.json({ error: `Horus injoignable : ${message}` }, 502);
    } finally {
      clearTimeout(timeout);
    }
  };
}
