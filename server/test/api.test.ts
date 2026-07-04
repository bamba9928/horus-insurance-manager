/**
 * Tests d'intégration de l'API métier : CRUD, dossier complet, dashboard,
 * et surtout l'ISOLATION entre tenants (un utilisateur ne voit jamais les
 * données d'un autre).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AuthEnv } from "../src/auth/middleware.js";
import { hashPassword } from "../src/auth/password.js";
import { LoginRateLimiter } from "../src/auth/rateLimit.js";
import { createUser, openAdminDb } from "../src/db/adminDb.js";
import { closeAllTenantDbs, provisionTenantDb } from "../src/db/tenants.js";

const PASSWORD = "password-123";

let dataDir: string;
let adminDb: ReturnType<typeof openAdminDb>;
let app: Hono<AuthEnv>;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function cookieValue(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1] ?? "") : undefined;
}

async function seedUser(login: string): Promise<number> {
  const id = createUser(adminDb, {
    login,
    nom: login,
    passwordHash: await hashPassword(PASSWORD),
    role: "USER",
  });
  provisionTenantDb(dataDir, id);
  return id;
}

async function loginAs(login: string): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login, password: PASSWORD }),
  });
  const raw = res.headers.get("set-cookie") ?? "";
  const session = raw.match(/horus_session=([^;,]+)/);
  const csrf = raw.match(/horus_csrf=([^;,]+)/);
  if (!session || !csrf) throw new Error(`Cookies de session incomplets : ${raw}`);
  return `horus_session=${session[1]}; horus_csrf=${csrf[1]}`;
}

interface CallOptions {
  method?: string;
  body?: unknown;
  cookie: string;
}

async function call(route: string, opts: CallOptions): Promise<Response> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { cookie: opts.cookie };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const csrfToken = cookieValue(opts.cookie, "horus_csrf");
  if (csrfToken && MUTATING_METHODS.has(method)) headers["x-csrf-token"] = csrfToken;
  return app.request(route, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

let cookieA = "";
let cookieB = "";

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "horus-api-test-"));
  adminDb = openAdminDb(dataDir);
  await seedUser("userA");
  await seedUser("userB");
  app = buildApp({
    env: {
      port: 0,
      dataDir,
      cookieSecure: false,
      adminLogin: "admin",
      adminPassword: undefined,
      staticDir: undefined,
    },
    adminDb,
    rateLimiter: new LoginRateLimiter(),
  });
  cookieA = await loginAs("userA");
  cookieB = await loginAs("userB");
});

afterAll(() => {
  closeAllTenantDbs();
  adminDb.close();
  fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe("authentification requise", () => {
  it("refuse l'API sans session", async () => {
    const res = await app.request("/api/clients");
    expect(res.status).toBe(401);
  });
});

describe("CRUD clients", () => {
  it("crée, lit, met à jour et supprime un client", async () => {
    const create = await call("/api/clients", {
      method: "POST",
      cookie: cookieA,
      body: { nomPrenom: "Mamadou Diallo", telephone: "77 123 45 67" },
    });
    expect(create.status).toBe(201);
    const { id } = (await create.json()) as { id: number };
    expect(id).toBeGreaterThan(0);

    const get = await call(`/api/clients/${id}`, { cookie: cookieA });
    expect(get.status).toBe(200);
    expect(((await get.json()) as { nom_prenom: string }).nom_prenom).toBe("Mamadou Diallo");

    const patch = await call(`/api/clients/${id}`, {
      method: "PATCH",
      cookie: cookieA,
      body: { id, nomPrenom: "Mamadou B. Diallo" },
    });
    expect(patch.status).toBe(200);

    const get2 = await call(`/api/clients/${id}`, { cookie: cookieA });
    expect(((await get2.json()) as { nom_prenom: string }).nom_prenom).toBe("Mamadou B. Diallo");

    const del = await call(`/api/clients/${id}`, { method: "DELETE", cookie: cookieA });
    expect(del.status).toBe(200);
    expect((await call(`/api/clients/${id}`, { cookie: cookieA })).status).toBe(404);
  });

  it("rejette des données invalides (nom trop court)", async () => {
    const res = await call("/api/clients", {
      method: "POST",
      cookie: cookieA,
      body: { nomPrenom: "X" },
    });
    expect(res.status).toBe(400);
  });
});

describe("isolation entre tenants", () => {
  it("un utilisateur ne voit pas les clients d'un autre", async () => {
    await call("/api/clients", {
      method: "POST",
      cookie: cookieA,
      body: { nomPrenom: "Client de A" },
    });
    await call("/api/clients", {
      method: "POST",
      cookie: cookieB,
      body: { nomPrenom: "Client de B" },
    });

    const listA = (await (await call("/api/clients", { cookie: cookieA })).json()) as Array<{
      nom_prenom: string;
    }>;
    const listB = (await (await call("/api/clients", { cookie: cookieB })).json()) as Array<{
      nom_prenom: string;
    }>;

    const namesA = listA.map((c) => c.nom_prenom);
    const namesB = listB.map((c) => c.nom_prenom);
    expect(namesA).toContain("Client de A");
    expect(namesA).not.toContain("Client de B");
    expect(namesB).toContain("Client de B");
    expect(namesB).not.toContain("Client de A");
  });

  it("un client de A est introuvable via la session de B", async () => {
    const create = await call("/api/clients", {
      method: "POST",
      cookie: cookieA,
      body: { nomPrenom: "Secret de A" },
    });
    const { id } = (await create.json()) as { id: number };
    // Même id numérique, mais base différente → 404 chez B
    expect((await call(`/api/clients/${id}`, { cookie: cookieB })).status).toBe(404);
  });
});

describe("dossier complet + dashboard", () => {
  it("enregistre un dossier et le retrouve dans le récap", async () => {
    const res = await call("/api/dossiers", {
      method: "POST",
      cookie: cookieB,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Dossier Test" } },
        vehicule: { mode: "nouveau", data: { immatriculation: "DK 4321 ZZ", marque: "TOYOTA" } },
        police: { typeCarte: "VERTE", dateEffet: "2026-01-15", dureeMois: 12 },
        paiement: { montantDu: 100000, paye: 40000, avance: 0 },
      },
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      clientId: number;
      vehiculeId: number;
      policeId: number;
      paiementId: number | null;
    };
    expect(created.clientId).toBeGreaterThan(0);
    expect(created.vehiculeId).toBeGreaterThan(0);
    expect(created.policeId).toBeGreaterThan(0);
    expect(created.paiementId).toBeGreaterThan(0);

    // La police porte l'échéance calculée (colonne générée)
    const police = (await (
      await call(`/api/polices/${created.policeId}`, { cookie: cookieB })
    ).json()) as { date_echeance: string; vehicule_id: number };
    expect(police.date_echeance).toBe("2027-01-14");
    expect(police.vehicule_id).toBe(created.vehiculeId);

    // Le paiement partiel apparaît dans les impayés
    const impayes = (await (
      await call("/api/dashboard/impayes", { cookie: cookieB })
    ).json()) as Array<{ reste: number; nom_prenom: string }>;
    const impaye = impayes.find((i) => i.nom_prenom === "Dossier Test");
    expect(impaye?.reste).toBe(60000);

    // Le KPI reflète au moins une police active
    const kpi = (await (await call("/api/dashboard/kpi", { cookie: cookieB })).json()) as {
      policesActives: number;
    };
    expect(kpi.policesActives).toBeGreaterThanOrEqual(1);
  });

  it("rollback intégral si le dossier est invalide (aucune ligne orpheline)", async () => {
    const before = (await (await call("/api/clients", { cookie: cookieA })).json()) as unknown[];
    const res = await call("/api/dossiers", {
      method: "POST",
      cookie: cookieA,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Ne doit pas persister" } },
        vehicule: { mode: "nouveau", data: { immatriculation: "INVALIDE!!!" } },
        police: { typeCarte: "VERTE", dateEffet: "2026-01-15", dureeMois: 12 },
      },
    });
    expect(res.status).toBe(400); // immatriculation invalide → rejet à la validation
    const after = (await (await call("/api/clients", { cookie: cookieA })).json()) as unknown[];
    expect(after.length).toBe(before.length);
  });
});

describe("renouvellement de police", () => {
  it("crée une nouvelle police et marque l'ancienne RENOUVELÉE", async () => {
    const dossier = await call("/api/dossiers", {
      method: "POST",
      cookie: cookieA,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Renouvellement" } },
        vehicule: { mode: "nouveau", data: { immatriculation: "DK 9999 RR" } },
        police: { typeCarte: "VERTE", dateEffet: "2025-01-01", dureeMois: 12 },
      },
    });
    const { policeId } = (await dossier.json()) as { policeId: number };

    const renew = await call(`/api/polices/${policeId}/renew`, { method: "POST", cookie: cookieA });
    expect(renew.status).toBe(201);
    const { id: newId } = (await renew.json()) as { id: number };
    expect(newId).toBeGreaterThan(policeId);

    const old = (await (await call(`/api/polices/${policeId}`, { cookie: cookieA })).json()) as {
      statut: string;
    };
    expect(old.statut).toBe("RENOUVELÉE");
  });
});

describe("sauvegarde / restauration", () => {
  it("télécharge une base valide puis la restaure à l'identique", async () => {
    // Marqueur unique dans la base de A
    await call("/api/clients", {
      method: "POST",
      cookie: cookieA,
      body: { nomPrenom: "Marqueur Backup" },
    });

    const backup = await call("/api/backup", { cookie: cookieA });
    expect(backup.status).toBe(200);
    expect(backup.headers.get("content-type")).toBe("application/octet-stream");
    const bytes = new Uint8Array(await backup.arrayBuffer());
    // En-tête magique d'un fichier SQLite
    expect(new TextDecoder().decode(bytes.slice(0, 15))).toBe("SQLite format 3");

    // Supprimer le marqueur, puis restaurer → il doit réapparaître
    const list = (await (await call("/api/clients", { cookie: cookieA })).json()) as Array<{
      id: number;
      nom_prenom: string;
    }>;
    const marqueur = list.find((c) => c.nom_prenom === "Marqueur Backup");
    await call(`/api/clients/${marqueur?.id}`, { method: "DELETE", cookie: cookieA });

    const restore = await app.request("/api/restore", {
      method: "POST",
      headers: {
        cookie: cookieA,
        "content-type": "application/octet-stream",
        "x-csrf-token": cookieValue(cookieA, "horus_csrf") ?? "",
      },
      body: bytes,
    });
    expect(restore.status).toBe(200);

    const after = (await (await call("/api/clients", { cookie: cookieA })).json()) as Array<{
      nom_prenom: string;
    }>;
    expect(after.map((c) => c.nom_prenom)).toContain("Marqueur Backup");
  });

  it("rejette un fichier qui n'est pas une base Horus", async () => {
    const res = await app.request("/api/restore", {
      method: "POST",
      headers: {
        cookie: cookieA,
        "content-type": "application/octet-stream",
        "x-csrf-token": cookieValue(cookieA, "horus_csrf") ?? "",
      },
      body: new Uint8Array([1, 2, 3, 4, 5]),
    });
    expect(res.status).toBe(400);
  });
});

describe("intégrations", () => {
  it("liste l'aperçu des intégrations par compagnie", async () => {
    await call("/api/assureurs", {
      method: "POST",
      cookie: cookieA,
      body: { nom: "AXA Test", integrationType: "MANUAL" },
    });
    const overview = (await (
      await call("/api/integrations/overview", { cookie: cookieA })
    ).json()) as Array<{ nom: string }>;
    expect(overview.map((o) => o.nom)).toContain("AXA Test");
  });
});

describe("contraintes", () => {
  it("renvoie 409 sur une immatriculation en doublon", async () => {
    const clientRes = await call("/api/clients", {
      method: "POST",
      cookie: cookieB,
      body: { nomPrenom: "Proprio doublon" },
    });
    const { id: clientId } = (await clientRes.json()) as { id: number };

    const first = await call("/api/vehicules", {
      method: "POST",
      cookie: cookieB,
      body: { clientId, immatriculation: "DK 1111 AA" },
    });
    expect(first.status).toBe(201);

    const dup = await call("/api/vehicules", {
      method: "POST",
      cookie: cookieB,
      body: { clientId, immatriculation: "DK 1111 AA" },
    });
    expect(dup.status).toBe(409);
  });
});
