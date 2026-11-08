/**
 * Prime de base ASS lue via Horus : traduction des catégories et appel sortant.
 */

import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { primeBaseHandler, toHorusPayload } from "../src/routes/primeBase.js";

const ENV = { horusApiUrl: "https://horus.example/api", horusApiKey: "hrs_test_test" };

function appWith(env: { horusApiUrl: string; horusApiKey: string | undefined }) {
  const app = new Hono();
  app.post("/prime-base", primeBaseHandler(env));
  return app;
}

function post(app: Hono, body: unknown) {
  return app.request("/prime-base", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toHorusPayload", () => {
  it.each([
    ["CAT_01_VP", "VP"],
    ["CAT_02_TPC_LT3T5_FGTTE", "TPC"],
    ["CAT_02_TPC_LT3T5_CAMIONNETTE", "TPC3T500"],
    ["CAT_02_TPC_GT3T5", "TPC3T500P"],
    ["CAT_03_TPM_LT3T5", "TPM3T500"],
    ["CAT_03_TPM_GT3T5", "TPM3T500P"],
  ])("%s → genre ASS %s", (categorie, genre) => {
    expect(toHorusPayload({ categorie, puissance: 9, dureeMois: 3 })).toEqual({
      subcategory: genre,
      duration: 3,
      fiscal_power: 9,
    });
  });

  it("deux-roues : genre selon la cylindrée, tricycle en side-car", () => {
    expect(toHorusPayload({ categorie: "CAT_05_2R", cylindree: "GT_125", dureeMois: 12 })).toEqual({
      subcategory: "2RMOT",
      duration: 12,
      cylindree: 250,
    });
    expect(toHorusPayload({ categorie: "TRICYCLE", dureeMois: 1 })?.subcategory).toBe("2RSID");
  });

  it("TPV et catégories inconnues ne sont pas tarifés en ligne", () => {
    expect(toHorusPayload({ categorie: "CAT_04_TPV", puissance: 7, dureeMois: 1 })).toBeNull();
    expect(toHorusPayload({ categorie: "CAT_01_VP", dureeMois: 1 })).toBeNull();
  });
});

describe("primeBaseHandler", () => {
  it("renvoie la prime de base ASS lue dans la réponse Horus", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ decompte_client: { prime_base: 4469, reduction: 894, prime_rc: 3575 } }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await post(appWith(ENV), { categorie: "CAT_01_VP", puissance: 9, dureeMois: 1 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ primeBase: 4469, genre: "VP", source: "ASS" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://horus.example/api/contracts/tarification/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Api-Key hrs_test_test" }),
        body: JSON.stringify({ subcategory: "VP", duration: 1, fiscal_power: 9 }),
      }),
    );
  });

  it("refuse une catégorie non tarifée en ligne sans appeler Horus", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await post(appWith(ENV), {
      categorie: "CAT_04_TPV",
      puissance: 7,
      dureeMois: 1,
    });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe("unsupported");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("remonte l'erreur Horus en 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ detail: "Cle API invalide." }), { status: 401 }),
      ),
    );

    const res = await post(appWith(ENV), { categorie: "CAT_01_VP", puissance: 9, dureeMois: 1 });

    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toContain("Cle API invalide");
  });

  it("rejette une réponse sans prime de base", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ decompte_client: null }), { status: 200 })),
    );

    const res = await post(appWith(ENV), { categorie: "CAT_01_VP", puissance: 9, dureeMois: 1 });

    expect(res.status).toBe(502);
  });

  it("valide les paramètres", async () => {
    const res = await post(appWith(ENV), { categorie: "CAT_01_VP", puissance: 9, dureeMois: 13 });
    expect(res.status).toBe(400);
  });
});
