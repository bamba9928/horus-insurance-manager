/**
 * Routes d'administration (super admin uniquement) :
 * création de comptes, réinitialisation de mot de passe, suspension.
 *
 * @module routes/admin
 */

import fs from "node:fs";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app.js";
import { requireCsrf } from "../auth/csrf.js";
import type { AuthEnv } from "../auth/middleware.js";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import { hashPassword } from "../auth/password.js";
import { deleteUserSessions } from "../auth/sessions.js";
import {
  createUser,
  findUserById,
  findUserByLogin,
  listUsers,
  recordSecurityEvent,
  setUserActive,
  updateUserPassword,
} from "../db/adminDb.js";
import { provisionTenantDb, tenantDbPath } from "../db/tenants.js";

const createUserSchema = z.object({
  login: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{3,50}$/, "Login invalide (3-50 caractères, lettres/chiffres/._-)"),
  nom: z.string().min(2).max(200),
  password: z.string().min(8, "8 caractères minimum").max(200),
  role: z.enum(["ADMIN", "USER"]).optional().default("USER"),
});

const passwordSchema = z.object({
  password: z.string().min(8, "8 caractères minimum").max(200),
});

const activeSchema = z.object({
  actif: z.boolean(),
});

function parseUserId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function clientIp(header: string | undefined): string {
  return header?.split(",")[0]?.trim() || "local";
}

function countRows(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

function tenantStats(dataDir: string, userId: number) {
  const dbPath = tenantDbPath(dataDir, userId);
  let dbSizeBytes: number | null = null;
  try {
    dbSizeBytes = fs.statSync(dbPath).size;
  } catch {
    return {
      db_size_bytes: null,
      clients_count: null,
      vehicules_count: null,
      polices_count: null,
      paiements_count: null,
    };
  }

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      return {
        db_size_bytes: dbSizeBytes,
        clients_count: countRows(db, "clients"),
        vehicules_count: countRows(db, "vehicules"),
        polices_count: countRows(db, "polices"),
        paiements_count: countRows(db, "paiements"),
      };
    } finally {
      db.close();
    }
  } catch {
    return {
      db_size_bytes: dbSizeBytes,
      clients_count: null,
      vehicules_count: null,
      polices_count: null,
      paiements_count: null,
    };
  }
}

export function adminRoutes(ctx: AppContext): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.use("*", requireAuth(ctx.adminDb, ctx.env.cookieSecure), requireAdmin);
  app.use("*", requireCsrf);

  /** Liste des comptes avec la taille de leur base. */
  app.get("/users", (c) => {
    const users = listUsers(ctx.adminDb).map((u) => ({
      ...u,
      ...tenantStats(ctx.env.dataDir, u.id),
    }));
    return c.json({ users });
  });

  /** Crée un compte + provisionne sa base métier. */
  app.post("/users", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, 400);
    }

    if (findUserByLogin(ctx.adminDb, parsed.data.login)) {
      return c.json({ error: "Ce login existe déjà" }, 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    let userId: number;
    try {
      userId = createUser(ctx.adminDb, {
        login: parsed.data.login,
        nom: parsed.data.nom,
        passwordHash,
        role: parsed.data.role,
      });
    } catch (err) {
      // Course entre le contrôle ci-dessus et l'INSERT (double soumission) :
      // la contrainte UNIQUE tranche, on renvoie 409 plutôt que 500.
      if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        return c.json({ error: "Ce login existe déjà" }, 409);
      }
      throw err;
    }
    provisionTenantDb(ctx.env.dataDir, userId);
    recordSecurityEvent(ctx.adminDb, {
      action: "USER_CREATE",
      userId: c.get("user").id,
      login: c.get("user").login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
      detail: JSON.stringify({
        targetUserId: userId,
        targetLogin: parsed.data.login,
        targetRole: parsed.data.role,
      }),
    });

    const user = findUserById(ctx.adminDb, userId);
    return c.json(
      { user: user ? { id: user.id, login: user.login, nom: user.nom, role: user.role } : null },
      201,
    );
  });

  /** Réinitialise le mot de passe d'un compte (détruit ses sessions). */
  app.post("/users/:id/password", async (c) => {
    const userId = parseUserId(c.req.param("id"));
    if (userId == null) return c.json({ error: "Identifiant invalide" }, 400);

    const body = await c.req.json().catch(() => null);
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, 400);
    }

    if (!findUserById(ctx.adminDb, userId)) {
      return c.json({ error: "Utilisateur introuvable" }, 404);
    }

    updateUserPassword(ctx.adminDb, userId, await hashPassword(parsed.data.password));
    deleteUserSessions(ctx.adminDb, userId);
    recordSecurityEvent(ctx.adminDb, {
      action: "USER_PASSWORD_RESET",
      userId: c.get("user").id,
      login: c.get("user").login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
      detail: JSON.stringify({ targetUserId: userId }),
    });
    return c.json({ ok: true });
  });

  /** Suspend ou réactive un compte (la suspension détruit ses sessions). */
  app.post("/users/:id/active", async (c) => {
    const userId = parseUserId(c.req.param("id"));
    if (userId == null) return c.json({ error: "Identifiant invalide" }, 400);

    const body = await c.req.json().catch(() => null);
    const parsed = activeSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Requête invalide" }, 400);

    if (userId === c.get("user").id && !parsed.data.actif) {
      return c.json({ error: "Impossible de suspendre son propre compte" }, 400);
    }
    if (!findUserById(ctx.adminDb, userId)) {
      return c.json({ error: "Utilisateur introuvable" }, 404);
    }

    setUserActive(ctx.adminDb, userId, parsed.data.actif);
    if (!parsed.data.actif) deleteUserSessions(ctx.adminDb, userId);
    recordSecurityEvent(ctx.adminDb, {
      action: "USER_ACTIVE_CHANGE",
      userId: c.get("user").id,
      login: c.get("user").login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
      detail: JSON.stringify({ targetUserId: userId, actif: parsed.data.actif }),
    });
    return c.json({ ok: true });
  });

  return app;
}
