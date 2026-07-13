/**
 * Tests d'intégration de l'API métier : CRUD, dossier complet, dashboard,
 * et surtout l'ISOLATION entre tenants (un utilisateur ne voit jamais les
 * données d'un autre).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AuthEnv } from "../src/auth/middleware.js";
import { hashPassword } from "../src/auth/password.js";
import { LoginRateLimiter } from "../src/auth/rateLimit.js";
import { createUser, openAdminDb } from "../src/db/adminDb.js";
import { closeAllTenantDbs, provisionTenantDb } from "../src/db/tenants.js";

const PASSWORD = "password-123";
const ADMIN_EMAIL = "bossadmin@example.com";

let dataDir: string;
let adminDb: ReturnType<typeof openAdminDb>;
let app: Hono<AuthEnv>;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function cookieValue(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1] ?? "") : undefined;
}

async function seedUser(login: string, role: "USER" | "ADMIN" = "USER"): Promise<number> {
  const id = createUser(adminDb, {
    login,
    nom: login,
    email: `${login}@example.com`,
    passwordHash: await hashPassword(PASSWORD),
    role,
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

async function createTestAssureur(cookie: string, nom: string): Promise<number> {
  const res = await call("/api/assureurs", {
    method: "POST",
    cookie,
    body: { nom, integrationType: "MANUAL" },
  });
  if (res.status !== 201) throw new Error(`Création assureur échouée : ${res.status}`);
  return ((await res.json()) as { id: number }).id;
}

let cookieA = "";
let cookieB = "";
let cookieAdmin = "";
let userAId = 0;
let adminId = 0;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "horus-api-test-"));
  adminDb = openAdminDb(dataDir);
  userAId = await seedUser("userA");
  await seedUser("userB");
  adminId = await seedUser("bossadmin", "ADMIN");
  app = buildApp({
    env: {
      port: 0,
      dataDir,
      cookieSecure: false,
      adminLogin: "admin",
      adminEmail: ADMIN_EMAIL,
      adminPassword: undefined,
      staticDir: undefined,
      publicSiteUrl: undefined,
      allowRegistration: true,
      adminContactEmail: "contact@horus-assur.digital",
    },
    adminDb,
    rateLimiter: new LoginRateLimiter(),
  });
  cookieA = await loginAs("userA@example.com");
  cookieB = await loginAs("userB@example.com");
  cookieAdmin = await loginAs("bossadmin@example.com");
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
    const assureurId = await createTestAssureur(cookieB, "Compagnie Dossier Test");
    const res = await call("/api/dossiers", {
      method: "POST",
      cookie: cookieB,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Dossier Test" } },
        vehicule: {
          mode: "nouveau",
          data: {
            immatriculation: "DK 4321 ZZ",
            marque: "TOYOTA",
            genre: "CAT_01",
            typeVehicule: "Véhicule particulier",
          },
        },
        police: { assureurId, typeCarte: "VERTE", dateEffet: "2026-01-15", dureeMois: 12 },
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
    const assureurId = await createTestAssureur(cookieA, "Compagnie Rollback");
    const before = (await (await call("/api/clients", { cookie: cookieA })).json()) as unknown[];
    const res = await call("/api/dossiers", {
      method: "POST",
      cookie: cookieA,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Ne doit pas persister" } },
        vehicule: {
          mode: "nouveau",
          data: {
            immatriculation: "INVALIDE!!!",
            genre: "CAT_01",
            typeVehicule: "Véhicule particulier",
          },
        },
        police: { assureurId, typeCarte: "VERTE", dateEffet: "2026-01-15", dureeMois: 12 },
      },
    });
    expect(res.status).toBe(400); // immatriculation invalide → rejet à la validation
    const after = (await (await call("/api/clients", { cookie: cookieA })).json()) as unknown[];
    expect(after.length).toBe(before.length);
  });
});

describe("renouvellement de police", () => {
  it("crée une nouvelle police et marque l'ancienne RENOUVELÉE", async () => {
    const assureurId = await createTestAssureur(cookieA, "Compagnie Renouvellement");
    const dossier = await call("/api/dossiers", {
      method: "POST",
      cookie: cookieA,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Renouvellement" } },
        vehicule: {
          mode: "nouveau",
          data: {
            immatriculation: "DK 9999 RR",
            genre: "CAT_01",
            typeVehicule: "Véhicule particulier",
          },
        },
        police: { assureurId, typeCarte: "VERTE", dateEffet: "2025-01-01", dureeMois: 12 },
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

describe("vérification (proxy AAS)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("est accessible publiquement sans session", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            operationStatus: "ERROR",
            operationMessage: "Aucun contrat valide",
            data: null,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await app.request("/api/public/verify/DK1234AB");

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://apiaas.diotali.com/applicationtiers/verify/DK1234AB",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejette une immatriculation trop longue sans appeler l'API externe", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await call(`/api/verify/${"A".repeat(30)}`, { cookie: cookieA });
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("relaie une réponse SUCCESS de l'API externe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              operationStatus: "SUCCESS",
              operationMessage: "Attestation valide chez PREVOYANCE ASSURANCES",
              data: {
                attestationNumber: "SN008FTTA1N",
                dateVerification: "04-07-2026 17:34",
                immatriculation: "DK1234AB",
                dateEffet: "2026-02-01",
                dateEcheance: "2026-07-31 23:59:59",
                marque: "RENAULT",
                modele: "LOGAN",
              },
            }),
            { status: 200 },
          ),
      ),
    );

    const res = await call("/api/verify/DK1234AB", { cookie: cookieA });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { operationStatus: string; data: { marque: string } };
    expect(body.operationStatus).toBe("SUCCESS");
    expect(body.data.marque).toBe("RENAULT");
  });

  it("relaie une réponse ERROR métier (véhicule non assuré) avec 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              operationStatus: "ERROR",
              operationMessage: "L'attestation d'assurance (ZZ0000ZZ) n'est pas valide.",
              data: null,
            }),
            { status: 200 },
          ),
      ),
    );

    const res = await call("/api/verify/ZZ0000ZZ", { cookie: cookieA });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { operationStatus: string; data: null };
    expect(body.operationStatus).toBe("ERROR");
    expect(body.data).toBeNull();
  });

  it("renvoie 502 si l'API externe répond en erreur HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("service indisponible", { status: 503 })),
    );

    const res = await call("/api/verify/DK1234AB", { cookie: cookieA });
    expect(res.status).toBe(502);
  });

  it("renvoie 502 si l'API externe renvoie une réponse invalide", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ nawak: true }), { status: 200 })),
    );

    const res = await call("/api/verify/DK1234AB", { cookie: cookieA });
    expect(res.status).toBe(502);
  });

  it("renvoie 502 si l'appel réseau échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const res = await call("/api/verify/DK1234AB", { cookie: cookieA });
    expect(res.status).toBe(502);
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
      body: {
        clientId,
        immatriculation: "DK 1111 AA",
        genre: "CAT_01",
        typeVehicule: "Véhicule particulier",
      },
    });
    expect(first.status).toBe(201);

    const dup = await call("/api/vehicules", {
      method: "POST",
      cookie: cookieB,
      body: {
        clientId,
        immatriculation: "DK 1111 AA",
        genre: "CAT_01",
        typeVehicule: "Véhicule particulier",
      },
    });
    expect(dup.status).toBe(409);
  });
});

describe("permissions admin cross-tenant", () => {
  it("interdit à un utilisateur non-admin d'accéder aux données d'un autre", async () => {
    const res = await call(`/api/admin/tenants/${userAId}/clients`, { cookie: cookieB });
    expect(res.status).toBe(403);
  });

  it("interdit la mutation cross-tenant à un non-admin", async () => {
    const res = await call(`/api/admin/tenants/${userAId}/clients`, {
      method: "POST",
      cookie: cookieB,
      body: { nomPrenom: "Injection interdite" },
    });
    expect(res.status).toBe(403);
  });

  it("refuse l'accès sans session", async () => {
    const res = await app.request(`/api/admin/tenants/${userAId}/clients`);
    expect(res.status).toBe(401);
  });

  it("renvoie 404 pour un utilisateur cible inexistant", async () => {
    const res = await call("/api/admin/tenants/999999/clients", { cookie: cookieAdmin });
    expect(res.status).toBe(404);
  });

  it("renvoie 400 pour un identifiant de tenant invalide", async () => {
    const res = await call("/api/admin/tenants/0/clients", { cookie: cookieAdmin });
    expect(res.status).toBe(400);
  });

  it("laisse l'admin lire ET modifier les données d'un utilisateur", async () => {
    // L'admin crée un client DANS la base de userA
    const create = await call(`/api/admin/tenants/${userAId}/clients`, {
      method: "POST",
      cookie: cookieAdmin,
      body: { nomPrenom: "Créé par admin pour A", telephone: "770000000" },
    });
    expect(create.status).toBe(201);
    const { id } = (await create.json()) as { id: number };

    // userA le voit dans SA propre base (isolation respectée, admin a écrit au bon endroit)
    const listA = (await (await call("/api/clients", { cookie: cookieA })).json()) as Array<{
      id: number;
      nom_prenom: string;
    }>;
    expect(listA.map((c) => c.nom_prenom)).toContain("Créé par admin pour A");

    // userB ne le voit PAS
    const listB = (await (await call("/api/clients", { cookie: cookieB })).json()) as Array<{
      nom_prenom: string;
    }>;
    expect(listB.map((c) => c.nom_prenom)).not.toContain("Créé par admin pour A");

    // L'admin lit ce même client via la base de A
    const readByAdmin = await call(`/api/admin/tenants/${userAId}/clients/${id}`, {
      cookie: cookieAdmin,
    });
    expect(readByAdmin.status).toBe(200);

    // L'admin modifie puis supprime dans la base de A
    const patch = await call(`/api/admin/tenants/${userAId}/clients/${id}`, {
      method: "PATCH",
      cookie: cookieAdmin,
      body: { id, nomPrenom: "Modifié par admin" },
    });
    expect(patch.status).toBe(200);
    const del = await call(`/api/admin/tenants/${userAId}/clients/${id}`, {
      method: "DELETE",
      cookie: cookieAdmin,
    });
    expect(del.status).toBe(200);
  });

  it("journalise les mutations cross-tenant de l'admin", async () => {
    await call(`/api/admin/tenants/${userAId}/clients`, {
      method: "POST",
      cookie: cookieAdmin,
      body: { nomPrenom: "Trace audit" },
    });
    const row = adminDb
      .prepare(
        "SELECT COUNT(*) AS count FROM security_events WHERE action = 'ADMIN_TENANT_WRITE' AND user_id = ?",
      )
      .get(adminId) as { count: number };
    expect(row.count).toBeGreaterThanOrEqual(1);
  });
});

describe("garde-fou dernier administrateur", () => {
  it("refuse de suspendre le dernier administrateur actif", async () => {
    const res = await call(`/api/admin/users/${adminId}/active`, {
      method: "POST",
      cookie: cookieAdmin,
      body: { actif: false },
    });
    expect(res.status).toBe(400);
  });
});

describe("en-têtes de sécurité", () => {
  it("émet les en-têtes de durcissement et anti-cache sur /api", async () => {
    const res = await call("/api/clients", { cookie: cookieA });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("auto-inscription + validation admin", () => {
  let registerIpCounter = 0;
  function testEmail(localPart: string): string {
    return `${localPart}@example.com`;
  }

  async function registerAndCookie(localPart: string): Promise<string> {
    // IP distincte par inscription : le rate-limit est par IP, or les tests
    // partagent la même origine.
    registerIpCounter += 1;
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.0.0.${registerIpCounter}`,
      },
      body: JSON.stringify({
        nom: "Nouveau Venu",
        telephone1: "770000100",
        email: testEmail(localPart),
        password: "Passw0rd!",
        passwordConfirm: "Passw0rd!",
      }),
    });
    expect(res.status).toBe(201);
    const raw = res.headers.get("set-cookie") ?? "";
    const session = raw.match(/horus_session=([^;,]+)/);
    const csrf = raw.match(/horus_csrf=([^;,]+)/);
    if (!session || !csrf) throw new Error(`Cookies incomplets : ${raw}`);
    return `horus_session=${session[1]}; horus_csrf=${csrf[1]}`;
  }

  it("crée un compte en attente (approved=0) et ouvre une session", async () => {
    const cookie = await registerAndCookie("nouveau1");
    const me = (await (await call("/api/me", { cookie })).json()) as {
      user: { role: string; approved: boolean };
    };
    expect(me.user.role).toBe("USER");
    expect(me.user.approved).toBe(false);
  });

  it("crée un compte sans identifiant et permet la connexion par email", async () => {
    registerIpCounter += 1;
    const email = "email-login@example.com";
    const register = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.0.0.${registerIpCounter}`,
      },
      body: JSON.stringify({
        nom: "Compte Email",
        telephone1: "770000101",
        email,
        password: "Passw0rd!",
        passwordConfirm: "Passw0rd!",
      }),
    });
    expect(register.status).toBe(201);

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: email, password: "Passw0rd!" }),
    });
    expect(login.status).toBe(200);
  });

  it("refuse une auto-inscription sans téléphone", async () => {
    registerIpCounter += 1;
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.0.0.${registerIpCounter}`,
      },
      body: JSON.stringify({
        nom: "Sans Téléphone",
        email: "register-sans-telephone@example.com",
        password: "Passw0rd!",
        passwordConfirm: "Passw0rd!",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Téléphone obligatoire");
  });

  it("refuse une auto-inscription qui remplit le honeypot anti-bot", async () => {
    registerIpCounter += 1;
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.0.0.${registerIpCounter}`,
      },
      body: JSON.stringify({
        nom: "Bot Test",
        telephone1: "770000102",
        email: "bot-test@example.com",
        password: "Passw0rd!",
        passwordConfirm: "Passw0rd!",
        website: "https://spam.example",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("bloque « nouveau dossier » tant que non validé (403 ACCOUNT_PENDING)", async () => {
    const cookie = await registerAndCookie("nouveau2");
    const res = await call("/api/dossiers", {
      method: "POST",
      cookie,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Interdit" } },
        vehicule: {
          mode: "nouveau",
          data: {
            immatriculation: "DK 7777 AA",
            genre: "CAT_01",
            typeVehicule: "Véhicule particulier",
          },
        },
        police: { assureurId: 1, typeCarte: "VERTE", dateEffet: "2026-01-15", dureeMois: 12 },
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string; adminEmail?: string };
    expect(body.code).toBe("ACCOUNT_PENDING");
    expect(body.adminEmail).toBe("contact@horus-assur.digital");
  });

  it("bloque la vérification tant que non validé", async () => {
    const cookie = await registerAndCookie("nouveau3");
    const res = await call("/api/verify/DK1234AB", { cookie });
    expect(res.status).toBe(403);
  });

  it("l'admin valide le compte, débloquant les fonctions sensibles", async () => {
    const cookie = await registerAndCookie("nouveau4");
    // Retrouver l'id du compte via la liste admin
    const list = (await (await call("/api/admin/users", { cookie: cookieAdmin })).json()) as {
      users: Array<{ id: number; login: string; approved: 0 | 1 }>;
    };
    const target = list.users.find((u) => u.login === testEmail("nouveau4"));
    expect(target?.approved).toBe(0);

    const approve = await call(`/api/admin/users/${target?.id}/approve`, {
      method: "POST",
      cookie: cookieAdmin,
      body: { approved: true },
    });
    expect(approve.status).toBe(200);

    // La session existante voit désormais approved=true et peut vérifier
    const me = (await (await call("/api/me", { cookie })).json()) as {
      user: { approved: boolean };
    };
    expect(me.user.approved).toBe(true);

    const assureurId = await createTestAssureur(cookie, "Assureur Validé");
    const dossier = await call("/api/dossiers", {
      method: "POST",
      cookie,
      body: {
        client: { mode: "nouveau", data: { nomPrenom: "Enfin autorisé" } },
        vehicule: {
          mode: "nouveau",
          data: {
            immatriculation: "DK 8888 BB",
            genre: "CAT_01",
            typeVehicule: "Véhicule particulier",
          },
        },
        police: { assureurId, typeCarte: "VERTE", dateEffet: "2026-01-15", dureeMois: 12 },
      },
    });
    expect(dossier.status).toBe(201);
  });

  it("refuse un email déjà utilisé", async () => {
    await registerAndCookie("doublon-login");
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nom: "Autre",
        telephone1: "770000103",
        email: testEmail("doublon-login"),
        password: "Passw0rd!",
        passwordConfirm: "Passw0rd!",
      }),
    });
    expect(res.status).toBe(409);
  });
});
