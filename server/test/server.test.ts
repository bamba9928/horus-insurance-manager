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
import { createUser, openAdminDb } from "../src/db/adminDb.js";
import { provisionTenantDb, tenantDbPath } from "../src/db/tenants.js";

const ADMIN_PASSWORD = "admin-password-123";
const AGENT_PASSWORD = "agent-password-123";

let dataDir: string;
let adminDb: ReturnType<typeof openAdminDb>;
let app: Hono<AuthEnv>;

let adminCookie = "";
let agentCookie = "";
let agentId = 0;

interface ApiOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  ip?: string;
}

async function api(route: string, opts: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  return app.request(route, {
    method: opts.method ?? "GET",
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
  const match = raw.match(/horus_session=([^;]+)/);
  if (!match) throw new Error(`Pas de cookie de session dans : ${raw}`);
  return `horus_session=${match[1]}`;
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "horus-server-test-"));
  adminDb = openAdminDb(dataDir);
  const adminId = createUser(adminDb, {
    login: "admin",
    nom: "Super administrateur",
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
      adminPassword: undefined,
      staticDir: undefined,
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

describe("authentification", () => {
  it("refuse un login inconnu", async () => {
    const res = await login("inconnu", "whatever-123", "10.0.0.1");
    expect(res.status).toBe(401);
  });

  it("refuse un mauvais mot de passe", async () => {
    const res = await login("admin", "mauvais-mot-de-passe", "10.0.0.2");
    expect(res.status).toBe(401);
  });

  it("accepte les bons identifiants et pose un cookie httpOnly", async () => {
    const res = await login("admin", ADMIN_PASSWORD);
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
});

describe("administration des comptes", () => {
  it("crée un utilisateur et provisionne sa base métier", async () => {
    const res = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: { login: "agent1", nom: "Agent Un", password: AGENT_PASSWORD },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: number; role: string } };
    expect(body.user.role).toBe("USER");
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

  it("refuse un login en doublon", async () => {
    const res = await api("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: { login: "agent1", nom: "Doublon", password: "unmotdepasse" },
    });
    expect(res.status).toBe(409);
  });

  it("renvoie 409 (pas 500) sur une création concurrente du même login", async () => {
    // Deux créations simultanées : le contrôle d'existence préalable est
    // franchi par les deux, la contrainte UNIQUE tranche la seconde.
    const [a, b] = await Promise.all([
      api("/api/admin/users", {
        method: "POST",
        cookie: adminCookie,
        body: { login: "concurrent", nom: "Course A", password: "motdepasse1" },
      }),
      api("/api/admin/users", {
        method: "POST",
        cookie: adminCookie,
        body: { login: "concurrent", nom: "Course B", password: "motdepasse2" },
      }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("liste les comptes sans exposer les hashes", async () => {
    const res = await api("/api/admin/users", { cookie: adminCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: Array<Record<string, unknown>> };
    expect(body.users.map((u) => u.login)).toEqual(expect.arrayContaining(["admin", "agent1"]));
    for (const user of body.users) {
      expect(user).not.toHaveProperty("password_hash");
    }
  });

  it("interdit les routes admin à un simple utilisateur", async () => {
    const loginRes = await login("agent1", AGENT_PASSWORD);
    expect(loginRes.status).toBe(200);
    agentCookie = extractCookie(loginRes);

    const res = await api("/api/admin/users", { cookie: agentCookie });
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
    expect((await login("agent1", AGENT_PASSWORD, "10.0.0.3")).status).toBe(401);
    const newLogin = await login("agent1", "nouveau-mdp-456");
    expect(newLogin.status).toBe(200);
    agentCookie = extractCookie(newLogin);
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
    expect((await login("agent1", "nouveau-mdp-456")).status).toBe(403);

    const reactivate = await api(`/api/admin/users/${agentId}/active`, {
      method: "POST",
      cookie: adminCookie,
      body: { actif: true },
    });
    expect(reactivate.status).toBe(200);
    expect((await login("agent1", "nouveau-mdp-456")).status).toBe(200);
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
});

describe("protection contre la force brute", () => {
  it("bloque après 10 échecs depuis la même IP", async () => {
    const ip = "203.0.113.99";
    for (let i = 0; i < 10; i++) {
      const res = await login("admin", `tentative-${i}`, ip);
      expect(res.status).toBe(401);
    }
    // Même le bon mot de passe est bloqué pendant la fenêtre
    const blocked = await login("admin", ADMIN_PASSWORD, ip);
    expect(blocked.status).toBe(429);
  });
});

describe("déconnexion", () => {
  it("invalide la session au logout", async () => {
    const loginRes = await login("agent1", "nouveau-mdp-456");
    const cookie = extractCookie(loginRes);

    const logoutRes = await api("/api/auth/logout", { method: "POST", cookie });
    expect(logoutRes.status).toBe(200);

    const meRes = await api("/api/me", { cookie });
    expect(meRes.status).toBe(401);
  });
});
