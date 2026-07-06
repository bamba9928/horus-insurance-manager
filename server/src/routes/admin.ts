/**
 * Routes d'administration (super admin uniquement) :
 * création de comptes, modification, réinitialisation de mot de passe,
 * suspension et suppression.
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
  countActiveAdmins,
  createUser,
  deleteUser,
  findUserByEmail,
  findUserById,
  findUserByLogin,
  listUsers,
  recordSecurityEvent,
  setUserActive,
  setUserApproved,
  toSafeUser,
  updateUserAccountProfile,
  updateUserPassword,
} from "../db/adminDb.js";
import { deleteTenantDb, provisionTenantDb, tenantDbPath } from "../db/tenants.js";

function optionalText(max: number) {
  return z
    .preprocess((value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }, z.string().max(max).optional())
    .transform((value) => value ?? null);
}

function requiredText(max: number, message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().min(1, message).max(max),
  );
}

const createUserSchema = z
  .object({
    nom: z.string().trim().min(2).max(200),
    prenom: optionalText(200),
    adresse: optionalText(500),
    telephone1: requiredText(50, "Téléphone obligatoire"),
    telephone2: optionalText(50),
    email: z.string().trim().email("Email invalide").max(200),
    password: z.string().min(8, "8 caractères minimum").max(200),
    passwordConfirm: z.string().max(200).optional(),
    role: z.enum(["ADMIN", "USER"]).optional().default("USER"),
  })
  .refine((data) => data.passwordConfirm == null || data.password === data.passwordConfirm, {
    message: "La confirmation du mot de passe ne correspond pas",
    path: ["passwordConfirm"],
  });

const passwordSchema = z.object({
  password: z.string().min(8, "8 caractères minimum").max(200),
});

const userProfileSchema = z.object({
  nom: z.string().trim().min(2, "Nom trop court").max(200, "Nom trop long"),
  prenom: optionalText(200),
  adresse: optionalText(500),
  telephone1: optionalText(50),
  telephone2: optionalText(50),
  email: z.string().trim().email("Email invalide").max(200),
});

const activeSchema = z.object({
  actif: z.boolean(),
});

const approveSchema = z.object({
  approved: z.boolean(),
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

    const accountLogin = parsed.data.email;

    if (
      findUserByLogin(ctx.adminDb, accountLogin) ||
      findUserByEmail(ctx.adminDb, parsed.data.email)
    ) {
      return c.json({ error: "Cet email est déjà utilisé" }, 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    let userId: number;
    try {
      userId = createUser(ctx.adminDb, {
        login: accountLogin,
        nom: parsed.data.nom,
        prenom: parsed.data.prenom,
        adresse: parsed.data.adresse,
        telephone1: parsed.data.telephone1,
        telephone2: parsed.data.telephone2,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
      });
    } catch (err) {
      // Course entre le contrôle ci-dessus et l'INSERT (double soumission) :
      // la contrainte UNIQUE tranche, on renvoie 409 plutôt que 500.
      if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        return c.json({ error: "Cet email est déjà utilisé" }, 409);
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
        targetLogin: accountLogin,
        targetRole: parsed.data.role,
      }),
    });

    const user = findUserById(ctx.adminDb, userId);
    return c.json({ user: user ? toSafeUser(user) : null }, 201);
  });

  /** Modifie les informations personnelles d'un compte (admin uniquement). */
  app.patch("/users/:id", async (c) => {
    const userId = parseUserId(c.req.param("id"));
    if (userId == null) return c.json({ error: "Identifiant invalide" }, 400);

    const body = await c.req.json().catch(() => null);
    const parsed = userProfileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, 400);
    }

    const target = findUserById(ctx.adminDb, userId);
    if (!target) return c.json({ error: "Utilisateur introuvable" }, 404);

    const accountLogin = parsed.data.email;
    const userWithLogin = findUserByLogin(ctx.adminDb, accountLogin);
    const userWithEmail = findUserByEmail(ctx.adminDb, parsed.data.email);
    if (
      (userWithLogin && userWithLogin.id !== userId) ||
      (userWithEmail && userWithEmail.id !== userId)
    ) {
      return c.json({ error: "Cet email est déjà utilisé" }, 409);
    }

    try {
      updateUserAccountProfile(ctx.adminDb, userId, {
        login: accountLogin,
        nom: parsed.data.nom,
        prenom: parsed.data.prenom,
        adresse: parsed.data.adresse,
        telephone1: parsed.data.telephone1,
        telephone2: parsed.data.telephone2,
        email: parsed.data.email,
      });
    } catch (err) {
      if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        return c.json({ error: "Cet email est déjà utilisé" }, 409);
      }
      throw err;
    }

    recordSecurityEvent(ctx.adminDb, {
      action: "USER_PROFILE_UPDATE",
      userId: c.get("user").id,
      login: c.get("user").login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
      detail: JSON.stringify({ targetUserId: userId, targetLogin: accountLogin }),
    });

    const user = findUserById(ctx.adminDb, userId);
    return c.json({ user: user ? toSafeUser(user) : null });
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
    const target = findUserById(ctx.adminDb, userId);
    if (!target) {
      return c.json({ error: "Utilisateur introuvable" }, 404);
    }

    // Garde-fou : ne jamais suspendre le dernier administrateur actif, sinon
    // plus personne ne peut gérer les comptes.
    if (!parsed.data.actif && target.role === "ADMIN" && countActiveAdmins(ctx.adminDb) <= 1) {
      return c.json({ error: "Impossible de suspendre le dernier administrateur actif" }, 400);
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

  /** Valide (ou invalide) un compte auto-inscrit : débloque les fonctions sensibles. */
  app.post("/users/:id/approve", async (c) => {
    const userId = parseUserId(c.req.param("id"));
    if (userId == null) return c.json({ error: "Identifiant invalide" }, 400);

    const body = await c.req.json().catch(() => null);
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Requête invalide" }, 400);

    if (!findUserById(ctx.adminDb, userId)) {
      return c.json({ error: "Utilisateur introuvable" }, 404);
    }

    setUserApproved(ctx.adminDb, userId, parsed.data.approved);
    recordSecurityEvent(ctx.adminDb, {
      action: "USER_APPROVE",
      userId: c.get("user").id,
      login: c.get("user").login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
      detail: JSON.stringify({ targetUserId: userId, approved: parsed.data.approved }),
    });
    return c.json({ ok: true });
  });

  /** Supprime définitivement un compte et sa base métier (admin uniquement). */
  app.delete("/users/:id", (c) => {
    const userId = parseUserId(c.req.param("id"));
    if (userId == null) return c.json({ error: "Identifiant invalide" }, 400);

    if (userId === c.get("user").id) {
      return c.json({ error: "Impossible de supprimer son propre compte" }, 400);
    }

    const target = findUserById(ctx.adminDb, userId);
    if (!target) {
      return c.json({ error: "Utilisateur introuvable" }, 404);
    }

    if (target.role === "ADMIN" && target.actif === 1 && countActiveAdmins(ctx.adminDb) <= 1) {
      return c.json({ error: "Impossible de supprimer le dernier administrateur actif" }, 400);
    }

    deleteTenantDb(ctx.env.dataDir, userId);
    deleteUser(ctx.adminDb, userId);
    recordSecurityEvent(ctx.adminDb, {
      action: "USER_DELETE",
      userId: c.get("user").id,
      login: c.get("user").login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
      detail: JSON.stringify({
        targetUserId: userId,
        targetLogin: target.login,
        targetRole: target.role,
      }),
    });
    return c.json({ ok: true });
  });

  return app;
}
