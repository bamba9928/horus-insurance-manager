/**
 * Tests d'intégration du serveur : authentification, administration des
 * comptes, provisionnement des bases par utilisateur, isolation des rôles.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AuthEnv } from "../src/auth/middleware.js";
import { hashPassword } from "../src/auth/password.js";
import { LoginRateLimiter } from "../src/auth/rateLimit.js";
import {
  createUser,
  ensureUserEmailForLogin,
  findUserByEmail,
  openAdminDb,
} from "../src/db/adminDb.js";
import { provisionTenantDb, tenantDbPath } from "../src/db/tenants.js";

const ADMIN_PASSWORD = "admin-password-123";
const AGENT_PASSWORD = "agent-password-123";
const ADMIN_EMAIL = "admin@example.com";
const AGENT_EMAIL = "agent.un@example.com";
const ADMIN2_EMAIL = "admin2@example.com";

let dataDir: string;
let adminDb: ReturnType<typeof openAdminDb>;
let app: Hono<AuthEnv>;

let adminCookie = "";
let agentCookie = "";
let agentId = 0;
let agentPassword = AGENT_PASSWORD;

interface ApiOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  ip?: string;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function cookieValue(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1] ?? "") : undefined;
}

async function api(route: string, opts: ApiOptions = {}): Promise<Response> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  const csrfToken = opts.cookie ? cookieValue(opts.cookie, "horus_csrf") : undefined;
  if (csrfToken && MUTATING_METHODS.has(method)) headers["x-csrf-token"] = csrfToken;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  return app.request(route, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

async function login(loginName: string, password: string, ip?: string): Promise<Response> {
  return api("/api/auth/login", {
    method: "POST",
    body: { login: loginName, password },
    ...(ip ? { ip } : {}),
  });
}

function extractCookie(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const session = raw.match(/horus_session=([^;,]+)/);
  const csrf = raw.match(/horus_csrf=([^;,]+)/);
  if (!session || !csrf) throw new Error(`Cookies de session incomplets : ${raw}`);
  return `horus_session=${session[1]}; horus_csrf=${csrf[1]}`;
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "horus-server-test-"));
  adminDb = openAdminDb(dataDir);
  const adminId = createUser(adminDb, {
    login: "admin",
    nom: "Super administrateur",
    email: ADMIN_EMAIL,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    role: "ADMIN",
  });
  provisionTenantDb(dataDir, adminId);
  app = buildApp({
    env: {
      port: 0,
      dataDir,
      cookieSecure: false,
      adminLogin: "admin",
      adminEmail: ADMIN_EMAIL,
      adminPassword: undefined,
      staticDir: undefined,
      allowRegistration: true,
      adminContactEmail: "contact@horus-assur.digital",
    },
    adminDb,
    rateLimiter: new LoginRateLimiter(),
  });
});

afterAll(() => {
  adminDb.close();
  // Windows : les fichiers WAL peuvent rester verrouillés un court instant
  fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe("santé", () => {
  it("répond sur /api/health", async () => {
    const res = await api("/api/health");
    expect(res.status).toBe(200);
  });
});

describe("migration email admin", () => {
  it("renseigne l'email d'un compte existant depuis son login historique", async () => {
    const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), "horus-legacy-admin-"));
    const legacyDb = openAdminDb(legacyDir);
    try {
      createUser(legacyDb, {
        login: "admin",
        nom: "Ancien admin",
        passwordHash: await hashPassword("ancien-password"),
        role: "ADMIN",
      });

      ensureUserEmailForLogin(legacyDb, "admin", "admin.legacy@example.com");

      expect(findUserByEmail(legacyDb, "admin.legacy@example.com")?.login).toBe("admin");
    } finally {
      legacyDb.close();
      fs.rmSync(legacyDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });
});

describe("authentification", () => {
  it("refuse un login inconnu", async () => {
    const res = await login("inconnu@example.com", "whatever-123", "10.0.0.1");
    expect(res.status).toBe(401);
  });

  it("refuse un mauvais mot de passe", async () => {
    const res = await login(ADMIN_EMAIL, "mauvais-mot-de-passe", "10.0.0.2");
    expect(res.status).toBe(401);
  });

  it("refuse l'ancien identifiant texte : la connexion exige un email", async () => {
    const res = await login("admin", ADMIN_PASSWORD, "10.0.0.3");
    expect(res.status).toBe(400);
  });

  it("accepte les bons identifiants et pose un cookie httpOnly", async () => {
    const res = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { login: string; role: string } };
    expect(body.user.role).toBe("ADMIN");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    adminCookie = extractCookie(res);
  });

  it("refuse /api/me sans session", async () => {
    const res = await api("/api/me");
    expect(res.status).toBe(401);
  });

  it("renvoie l'utilisateur sur /api/me avec session", async () => {
    const res = await api("/api/me", { cookie: adminCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { login: string } };
    expect(body.user.login).toBe("admin");
  });

  it("interdit à l'utilisateur connecté de modifier ses informations personnelles", async () => {
    const res = await api("/api/profile", {
      method: "PATCH",
      cookie: adminCookie,
      body: {
        nom: "Principal",
        prenom: "Admin",
        adresse: "Plateau, Dakar",
        telephone1: "771112233",
        telephone2: "781112233",
        email: "admin.principal@example.com",
      },
    });
    expect(res.status).toBe(403);
  });
});

describe("administration des comptes", () => {
  it("crée un utilisateur et provisionne sa base métier", async () => {
    const res = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: {
        nom: "Un",
        prenom: "Agent",
        adresse: "Parcelles Assainies, Dakar",
        telephone1: "770000001",
        telephone2: "780000001",
        email: AGENT_EMAIL,
        password: AGENT_PASSWORD,
        passwordConfirm: AGENT_PASSWORD,
      },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: { id: number; role: string; prenom: string | null; email: string | null };
    };
    expect(body.user.role).toBe("USER");
    expect(body.user.prenom).toBe("Agent");
    expect(body.user.email).toBe(AGENT_EMAIL);
    agentId = body.user.id;

    // Le fichier SQLite du tenant existe avec le schéma métier complet
    const dbPath = tenantDbPath(dataDir, agentId);
    expect(fs.existsSync(dbPath)).toBe(true);

    const tenantDb = new Database(dbPath);
    try {
      const tables = (
        tenantDb
          .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')")
          .all() as Array<{ name: string }>
      ).map((r) => r.name);
      for (const expected of [
        "clients",
        "vehicules",
        "assureurs",
        "polices",
        "paiements",
        "v_echeances_30j",
        "v_impayes",
        "integration_exchange_logs",
      ]) {
        expect(tables).toContain(expected);
      }

      // La migration 003 a levé le CHECK obsolète : les catégories actuelles passent
      tenantDb.prepare("INSERT INTO clients (nom_prenom) VALUES (?)").run("Client Test");
      tenantDb
        .prepare("INSERT INTO vehicules (client_id, immatriculation, genre) VALUES (1, ?, ?)")
        .run("DK 1234 AB", "CAT_01");
      const veh = tenantDb
        .prepare("SELECT genre FROM vehicules WHERE immatriculation = ?")
        .get("DK 1234 AB") as { genre: string };
      expect(veh.genre).toBe("CAT_01");
    } finally {
      tenantDb.close();
    }
  });

  it("refuse un email en doublon", async () => {
    const res = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: {
        nom: "Doublon",
        telephone1: "770000002",
        email: AGENT_EMAIL,
        password: "unmotdepasse",
      },
    });
    expect(res.status).toBe(409);
  });

  it("refuse de créer un compte sans téléphone", async () => {
    const res = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: {
        nom: "Sans Téléphone",
        email: "sans-telephone@example.com",
        password: "password-123",
        passwordConfirm: "password-123",
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Téléphone obligatoire");
  });

  it("permet à l'admin de modifier les informations personnelles d'un compte", async () => {
    const res = await api(`/api/admin/users/${agentId}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: {
        nom: "Un Modifié",
        prenom: "Agent",
        adresse: "Mermoz, Dakar",
        telephone1: "771234000",
        telephone2: "781234000",
        email: AGENT_EMAIL,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: {
        login: string;
        nom: string;
        prenom: string | null;
        adresse: string | null;
        telephone1: string | null;
        telephone2: string | null;
        email: string | null;
      };
    };
    expect(body.user).toMatchObject({
      login: AGENT_EMAIL,
      nom: "Un Modifié",
      prenom: "Agent",
      adresse: "Mermoz, Dakar",
      telephone1: "771234000",
      telephone2: "781234000",
      email: AGENT_EMAIL,
    });
  });

  it("refuse de modifier un compte avec un email déjà utilisé", async () => {
    const res = await api(`/api/admin/users/${agentId}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: {
        nom: "Doublon",
        email: ADMIN_EMAIL,
      },
    });
    expect(res.status).toBe(409);
  });

  it("refuse une confirmation de mot de passe différente", async () => {
    const res = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: {
        nom: "Mismatch",
        telephone1: "770000003",
        email: "mismatch@example.com",
        password: "password-123",
        passwordConfirm: "password-456",
      },
    });
    expect(res.status).toBe(400);
  });

  it("renvoie 409 (pas 500) sur une création concurrente du même email", async () => {
    // Deux créations simultanées : le contrôle d'existence préalable est
    // franchi par les deux, la contrainte UNIQUE tranche la seconde.
    const [a, b] = await Promise.all([
      api("/api/admin/users", {
        method: "POST",
        cookie: adminCookie,
        body: {
          nom: "Course A",
          telephone1: "770000004",
          email: "concurrent@example.com",
          password: "motdepasse1",
        },
      }),
      api("/api/admin/users", {
        method: "POST",
        cookie: adminCookie,
        body: {
          nom: "Course B",
          telephone1: "770000005",
          email: "concurrent@example.com",
          password: "motdepasse2",
        },
      }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("permet à un admin de créer un autre compte administrateur", async () => {
    const res = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: {
        nom: "Administrateur Deux",
        telephone1: "770000006",
        email: ADMIN2_EMAIL,
        password: "admin-two-password",
        role: "ADMIN",
      },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { login: string; role: string } };
    expect(body.user.login).toBe(ADMIN2_EMAIL);
    expect(body.user.role).toBe("ADMIN");

    const loginRes = await login(ADMIN2_EMAIL, "admin-two-password");
    expect(loginRes.status).toBe(200);
    const cookie = extractCookie(loginRes);
    expect((await api("/api/admin/users", { cookie })).status).toBe(200);
  });

  it("liste les comptes sans exposer les hashes", async () => {
    const res = await api("/api/admin/users", { cookie: adminCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: Array<Record<string, unknown>> };
    expect(body.users.map((u) => u.login)).toEqual(expect.arrayContaining(["admin", AGENT_EMAIL]));
    for (const user of body.users) {
      expect(user).not.toHaveProperty("password_hash");
    }
    const agent = body.users.find((u) => u.login === AGENT_EMAIL);
    expect(agent?.prenom).toBe("Agent");
    expect(agent?.email).toBe(AGENT_EMAIL);
    expect(agent?.telephone1).toBe("771234000");
    expect(Number(agent?.clients_count ?? 0)).toBeGreaterThanOrEqual(1);
    expect(Number(agent?.vehicules_count ?? 0)).toBeGreaterThanOrEqual(1);
    expect(agent).toHaveProperty("polices_count");
    expect(agent).toHaveProperty("paiements_count");
  });

  it("interdit les routes admin à un simple utilisateur", async () => {
    const loginRes = await login(AGENT_EMAIL, AGENT_PASSWORD);
    expect(loginRes.status).toBe(200);
    agentCookie = extractCookie(loginRes);

    const res = await api("/api/admin/users", { cookie: agentCookie });
    expect(res.status).toBe(403);
  });

  it("refuse une mutation authentifiée sans jeton CSRF", async () => {
    const sessionOnly = `horus_session=${cookieValue(adminCookie, "horus_session")}`;
    const res = await app.request("/api/admin/users", {
      method: "POST",
      headers: { cookie: sessionOnly, "content-type": "application/json" },
      body: JSON.stringify({
        nom: "Sans CSRF",
        email: "sanscsrf@example.com",
        password: "password-123",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("réinitialise un mot de passe et détruit les sessions", async () => {
    const res = await api(`/api/admin/users/${agentId}/password`, {
      method: "POST",
      cookie: adminCookie,
      body: { password: "nouveau-mdp-456" },
    });
    expect(res.status).toBe(200);

    // Ancienne session détruite
    const meRes = await api("/api/me", { cookie: agentCookie });
    expect(meRes.status).toBe(401);

    // Ancien mot de passe refusé, nouveau accepté
    expect((await login(AGENT_EMAIL, AGENT_PASSWORD, "10.0.0.3")).status).toBe(401);
    const newLogin = await login(AGENT_EMAIL, "nouveau-mdp-456");
    expect(newLogin.status).toBe(200);
    agentCookie = extractCookie(newLogin);
    agentPassword = "nouveau-mdp-456";
  });

  it("suspend puis réactive un compte", async () => {
    const suspend = await api(`/api/admin/users/${agentId}/active`, {
      method: "POST",
      cookie: adminCookie,
      body: { actif: false },
    });
    expect(suspend.status).toBe(200);

    // Session coupée et connexion refusée
    expect((await api("/api/me", { cookie: agentCookie })).status).toBe(401);
    expect((await login(AGENT_EMAIL, agentPassword)).status).toBe(403);

    const reactivate = await api(`/api/admin/users/${agentId}/active`, {
      method: "POST",
      cookie: adminCookie,
      body: { actif: true },
    });
    expect(reactivate.status).toBe(200);
    expect((await login(AGENT_EMAIL, agentPassword)).status).toBe(200);
  });

  it("permet à l'utilisateur connecté de changer son mot de passe", async () => {
    const loginRes = await login(AGENT_EMAIL, agentPassword);
    expect(loginRes.status).toBe(200);
    agentCookie = extractCookie(loginRes);

    const wrongCurrent = await api("/api/profile/password", {
      method: "POST",
      cookie: agentCookie,
      body: { currentPassword: "mauvais-mdp", password: "profil-mdp-789" },
    });
    expect(wrongCurrent.status).toBe(400);

    const res = await api("/api/profile/password", {
      method: "POST",
      cookie: agentCookie,
      body: { currentPassword: agentPassword, password: "profil-mdp-789" },
    });
    expect(res.status).toBe(200);
    expect((await login(AGENT_EMAIL, agentPassword)).status).toBe(401);

    const newLogin = await login(AGENT_EMAIL, "profil-mdp-789");
    expect(newLogin.status).toBe(200);
    agentCookie = extractCookie(newLogin);
    agentPassword = "profil-mdp-789";
  });

  it("bloque le changement de mot de passe après 10 essais de mot de passe actuel erronés", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await api("/api/profile/password", {
        method: "POST",
        cookie: agentCookie,
        body: { currentPassword: `mauvais-${i}`, password: "nouveau-mdp-000" },
      });
      expect(res.status).toBe(400);
    }
    // Même le bon mot de passe actuel est bloqué pendant la fenêtre
    const blocked = await api("/api/profile/password", {
      method: "POST",
      cookie: agentCookie,
      body: { currentPassword: agentPassword, password: "nouveau-mdp-000" },
    });
    expect(blocked.status).toBe(429);
  });

  it("empêche l'admin de suspendre son propre compte", async () => {
    const meRes = await api("/api/me", { cookie: adminCookie });
    const me = (await meRes.json()) as { user: { id: number } };
    const res = await api(`/api/admin/users/${me.user.id}/active`, {
      method: "POST",
      cookie: adminCookie,
      body: { actif: false },
    });
    expect(res.status).toBe(400);
  });

  it("empêche l'admin de supprimer son propre compte", async () => {
    const meRes = await api("/api/me", { cookie: adminCookie });
    const me = (await meRes.json()) as { user: { id: number } };
    const res = await api(`/api/admin/users/${me.user.id}`, {
      method: "DELETE",
      cookie: adminCookie,
    });
    expect(res.status).toBe(400);
  });

  it("supprime un utilisateur, ses sessions et sa base métier", async () => {
    const email = "suppression@example.com";
    const password = "delete-password-123";
    const created = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: {
        nom: "Suppression",
        telephone1: "770000007",
        email,
        password,
        passwordConfirm: password,
      },
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { user: { id: number; login: string } };
    const deletedUserId = createdBody.user.id;
    const dbPath = tenantDbPath(dataDir, deletedUserId);
    expect(fs.existsSync(dbPath)).toBe(true);

    const loginRes = await login(email, password);
    expect(loginRes.status).toBe(200);
    const deletedUserCookie = extractCookie(loginRes);

    const forbidden = await api(`/api/admin/users/${deletedUserId}`, {
      method: "DELETE",
      cookie: agentCookie,
    });
    expect(forbidden.status).toBe(403);

    const deleted = await api(`/api/admin/users/${deletedUserId}`, {
      method: "DELETE",
      cookie: adminCookie,
    });
    expect(deleted.status).toBe(200);
    expect(fs.existsSync(dbPath)).toBe(false);
    expect((await api("/api/me", { cookie: deletedUserCookie })).status).toBe(401);
    expect((await login(email, password)).status).toBe(401);

    const list = await api("/api/admin/users", { cookie: adminCookie });
    const listBody = (await list.json()) as { users: Array<{ login: string }> };
    expect(listBody.users.some((u) => u.login === email)).toBe(false);

    const audit = adminDb
      .prepare("SELECT action, detail FROM security_events WHERE action = 'USER_DELETE'")
      .get() as { action: string; detail: string } | undefined;
    expect(audit?.action).toBe("USER_DELETE");
    expect(audit?.detail).toContain(`"targetUserId":${deletedUserId}`);
  });
});

describe("protection contre la force brute", () => {
  it("bloque après 10 échecs depuis la même IP", async () => {
    const ip = "203.0.113.99";
    for (let i = 0; i < 10; i++) {
      const res = await login(ADMIN_EMAIL, `tentative-${i}`, ip);
      expect(res.status).toBe(401);
    }
    // Même le bon mot de passe est bloqué pendant la fenêtre
    const blocked = await login(ADMIN_EMAIL, ADMIN_PASSWORD, ip);
    expect(blocked.status).toBe(429);
  });
});

describe("déconnexion", () => {
  it("invalide la session au logout", async () => {
    const loginRes = await login(AGENT_EMAIL, agentPassword);
    const cookie = extractCookie(loginRes);

    const logoutRes = await api("/api/auth/logout", { method: "POST", cookie });
    expect(logoutRes.status).toBe(200);

    const meRes = await api("/api/me", { cookie });
    expect(meRes.status).toBe(401);
  });
});
