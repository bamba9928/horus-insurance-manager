/**
 * API métier REST.
 *
 * Deux montages du MÊME jeu de routes :
 *  - `/api/*`               : opère sur la base de l'utilisateur CONNECTÉ
 *                             (isolation par tenant — chacun ne voit que ses
 *                             propres données).
 *  - `/api/admin/tenants/:userId/*` : réservé aux ADMIN, opère sur la base
 *                             d'un utilisateur cible (« l'admin voit — et
 *                             modifie — tout »). Les mutations sont journalisées.
 *
 * Dans les deux cas la base est résolue côté serveur : jamais à partir d'un
 * paramètre libre du corps de requête.
 *
 * @module routes/api
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { Context, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import type { AppContext } from "../app.js";
import { requireCsrf, SAFE_METHODS } from "../auth/csrf.js";
import type { AuthEnv } from "../auth/middleware.js";
import { requireAdmin, requireApproved, requireAuth } from "../auth/middleware.js";
import type { SlidingWindowLimiter } from "../auth/rateLimit.js";
import { findUserById, recordSecurityEvent, type SafeUser, toSafeUser } from "../db/adminDb.js";
import * as q from "../db/queries.js";
import { closeTenantDb, openTenantDb, tenantDbPath } from "../db/tenants.js";
import {
  assureurCreateSchema,
  assureurUpdateSchema,
  clientCreateSchema,
  clientUpdateSchema,
  dossierCreateSchema,
  echeancesRangeQuerySchema,
  listClientsQuerySchema,
  listPolicesQuerySchema,
  paiementCreateSchema,
  paiementUpdateSchema,
  policeCreateSchema,
  policeUpdateSchema,
  vehiculeCreateSchema,
  vehiculeUpdateSchema,
} from "../schemas.js";
import { verificationHandler } from "./verification.js";

/** Contexte enrichi des routes admin cross-tenant. */
type AdminTenantEnv = {
  Variables: AuthEnv["Variables"] & { targetUserId: number; targetUser: SafeUser };
};

/**
 * Résout la base métier à opérer. Le `userId` provient TOUJOURS d'une source
 * de confiance (session ou paramètre déjà validé par un middleware admin) —
 * garde-fou : on refuse tout identifiant non entier positif.
 */
function openTenantChecked(ctx: AppContext, userId: number): Database.Database {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`Tenant invalide: ${userId}`);
  }
  return openTenantDb(ctx.env.dataDir, userId);
}

/** Résolveur de base pour l'utilisateur connecté (isolation). */
function selfDb(ctx: AppContext, c: Context<AuthEnv>): Database.Database {
  return openTenantChecked(ctx, c.get("user").id);
}

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function clientIp(header: string | undefined): string {
  return header?.split(",")[0]?.trim() || "local";
}

const REQUIRED_RESTORE_COLUMNS: Record<string, string[]> = {
  clients: ["id", "nom_prenom"],
  vehicules: ["id", "client_id", "immatriculation"],
  assureurs: ["id", "nom"],
  polices: ["id", "vehicule_id", "type_carte", "date_effet", "duree_mois"],
  paiements: ["id", "police_id", "montant_du"],
};

function hasRequiredTenantSchema(db: Database.Database): boolean {
  for (const [table, requiredColumns] of Object.entries(REQUIRED_RESTORE_COLUMNS)) {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    if (!exists) return false;

    const columns = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
        (row) => row.name,
      ),
    );
    if (!requiredColumns.every((column) => columns.has(column))) return false;
  }
  return true;
}

/** Exécute une mutation en traduisant les erreurs de contrainte SQLite. */
function guardMutation<T>(c: Context<AuthEnv>, fn: () => T): Response | T {
  try {
    return fn();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "SQLITE_CONSTRAINT_UNIQUE") {
      return c.json({ error: "Valeur déjà utilisée (doublon)" }, 409);
    }
    if (code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return c.json({ error: "Référence invalide" }, 400);
    }
    throw err;
  }
}

/** Résolveur d'une base métier à partir du contexte de la requête. */
type TenantResolver = (c: Context<AuthEnv>) => Database.Database;

interface BusinessRoutesOptions {
  /** Inclure sauvegarde/restauration/vérification (réservé au périmètre « self »). */
  includeOperations: boolean;
}

/**
 * Enregistre l'ensemble des routes métier sur `app`, en résolvant la base
 * via `getDb`. Partagé entre l'API « self » et l'API admin cross-tenant afin
 * qu'un même comportement (et les mêmes validations) s'appliquent aux deux.
 */
function registerBusinessRoutes(
  app: Hono<AuthEnv>,
  ctx: AppContext,
  getDb: TenantResolver,
  opts: BusinessRoutesOptions,
): void {
  // ============ CLIENTS ============

  app.get("/clients", (c) => {
    const parsed = listClientsQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) return c.json({ error: "Paramètres invalides" }, 400);
    return c.json(q.listClients(getDb(c), parsed.data));
  });

  app.get("/clients/count", (c) => {
    const search = c.req.query("search");
    return c.json({ count: q.countClients(getDb(c), search) });
  });

  app.get("/clients/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const client = q.getClient(getDb(c), id);
    return client ? c.json(client) : c.json({ error: "Introuvable" }, 404);
  });

  app.post("/clients", async (c) => {
    const parsed = clientCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createClient(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ id: res }, 201);
  });

  app.patch("/clients/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const parsed = clientUpdateSchema.safeParse({ ...(await c.req.json().catch(() => ({}))), id });
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.updateClient(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/clients/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deleteClient(getDb(c), id);
    return c.json({ ok: true });
  });

  // ============ VÉHICULES ============

  app.get("/vehicules", (c) => {
    const clientId = c.req.query("clientId");
    const parsedId = clientId ? parseId(clientId) : undefined;
    if (clientId && parsedId == null) return c.json({ error: "clientId invalide" }, 400);
    return c.json(q.listVehicules(getDb(c), parsedId ?? undefined));
  });

  app.get("/vehicules/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const veh = q.getVehicule(getDb(c), id);
    return veh ? c.json(veh) : c.json({ error: "Introuvable" }, 404);
  });

  app.post("/vehicules", async (c) => {
    const parsed = vehiculeCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createVehicule(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ id: res }, 201);
  });

  app.patch("/vehicules/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const parsed = vehiculeUpdateSchema.safeParse({
      ...(await c.req.json().catch(() => ({}))),
      id,
    });
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.updateVehicule(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/vehicules/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deleteVehicule(getDb(c), id);
    return c.json({ ok: true });
  });

  // ============ ASSUREURS ============

  app.get("/assureurs", (c) => c.json(q.listAssureurs(getDb(c))));

  app.post("/assureurs", async (c) => {
    const parsed = assureurCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createAssureur(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ id: res }, 201);
  });

  app.patch("/assureurs/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const parsed = assureurUpdateSchema.safeParse({
      ...(await c.req.json().catch(() => ({}))),
      id,
    });
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.updateAssureur(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/assureurs/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deleteAssureur(getDb(c), id);
    return c.json({ ok: true });
  });

  // ============ INTÉGRATIONS ============

  app.get("/integrations/overview", (c) => c.json(q.listIntegrationOverview(getDb(c))));

  app.get("/integrations/logs", (c) => {
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
    const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 500 ? limit : 20;
    return c.json(q.listIntegrationExchangeLogs(getDb(c), safeLimit));
  });

  app.post("/integrations/:id/test", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    try {
      q.testAssureurIntegration(getDb(c), id);
      return c.json({ ok: true });
    } catch (err) {
      // Le test journalise déjà l'échec ; on renvoie le message métier.
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // ============ POLICES ============

  app.get("/polices", (c) => {
    const parsed = listPolicesQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) return c.json({ error: "Paramètres invalides" }, 400);
    return c.json(q.listPolices(getDb(c), parsed.data));
  });

  app.get("/polices/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const police = q.getPolice(getDb(c), id);
    return police ? c.json(police) : c.json({ error: "Introuvable" }, 404);
  });

  app.post("/polices", async (c) => {
    const parsed = policeCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createPolice(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ id: res }, 201);
  });

  app.patch("/polices/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const parsed = policeUpdateSchema.safeParse({ ...(await c.req.json().catch(() => ({}))), id });
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.updatePolice(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/polices/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deletePolice(getDb(c), id);
    return c.json({ ok: true });
  });

  app.post("/polices/:id/renew", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    try {
      return c.json({ id: q.renewPolice(getDb(c), id) }, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // ============ PAIEMENTS ============

  app.get("/paiements", (c) => {
    const policeId = c.req.query("policeId");
    const parsedId = policeId ? parseId(policeId) : undefined;
    if (policeId && parsedId == null) return c.json({ error: "policeId invalide" }, 400);
    return c.json(q.listPaiements(getDb(c), parsedId ?? undefined));
  });

  app.post("/paiements", async (c) => {
    const parsed = paiementCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createPaiement(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ id: res }, 201);
  });

  app.patch("/paiements/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const parsed = paiementUpdateSchema.safeParse({
      ...(await c.req.json().catch(() => ({}))),
      id,
    });
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.updatePaiement(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/paiements/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deletePaiement(getDb(c), id);
    return c.json({ ok: true });
  });

  // ============ DOSSIER COMPLET ============

  // « Nouveau dossier » : réservé aux comptes validés par un admin.
  app.post("/dossiers", requireApproved(ctx.env.adminContactEmail), async (c) => {
    const parsed = dossierCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createDossier(getDb(c), parsed.data));
    return res instanceof Response ? res : c.json(res, 201);
  });

  // ============ DASHBOARD ============

  app.get("/dashboard/kpi", (c) => c.json(q.getDashboardKPI(getDb(c))));
  app.get("/dashboard/echeances30j", (c) => c.json(q.getEcheances30j(getDb(c))));
  app.get("/dashboard/impayes", (c) => c.json(q.getImpayes(getDb(c))));
  app.get("/dashboard/recap", (c) => c.json(q.getDashboardRecap(getDb(c))));

  app.get("/dashboard/echeances-range", (c) => {
    const parsed = echeancesRangeQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) return c.json({ error: "Paramètres invalides" }, 400);
    return c.json(q.getEcheancesRange(getDb(c), parsed.data));
  });

  if (!opts.includeOperations) return;

  // ============ SAUVEGARDE / RESTAURATION (périmètre « self » uniquement) ============

  const MAX_RESTORE_BYTES = 200 * 1024 * 1024;

  /** Télécharge une copie cohérente de la base de l'utilisateur. */
  app.get("/backup", async (c) => {
    const db = getDb(c);
    const tmp = path.join(os.tmpdir(), `horus-backup-${crypto.randomBytes(8).toString("hex")}.db`);
    try {
      await db.backup(tmp);
      const bytes = fs.readFileSync(tmp);
      const user = c.get("user");
      recordSecurityEvent(ctx.adminDb, {
        action: "BACKUP_DATABASE",
        userId: user.id,
        login: user.login,
        ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
        success: true,
      });
      return new Response(bytes, {
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": 'attachment; filename="horus-backup.db"',
        },
      });
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  /** Remplace la base de l'utilisateur par un fichier fourni (validé au préalable). */
  app.post("/restore", async (c) => {
    const userId = c.get("user").id;
    const buffer = Buffer.from(await c.req.arrayBuffer());
    if (buffer.length === 0) return c.json({ error: "Fichier vide" }, 400);
    if (buffer.length > MAX_RESTORE_BYTES) return c.json({ error: "Fichier trop volumineux" }, 413);

    // Validation dans un fichier temporaire avant de toucher la vraie base.
    const tmp = path.join(os.tmpdir(), `horus-restore-${crypto.randomBytes(8).toString("hex")}.db`);
    fs.writeFileSync(tmp, buffer);
    try {
      // Ouverture + contrôles : toute erreur SQLite ⇒ fichier invalide (400).
      try {
        const candidate = new Database(tmp, { readonly: true });
        try {
          const integrity = candidate.pragma("integrity_check", { simple: true });
          if (integrity !== "ok") return c.json({ error: "Fichier de base corrompu" }, 400);
          if (!hasRequiredTenantSchema(candidate)) {
            return c.json({ error: "Ce fichier n'est pas une base Horus compatible" }, 400);
          }
        } finally {
          candidate.close();
        }
      } catch {
        return c.json({ error: "Fichier de base invalide" }, 400);
      }

      // Bascule : fermer la connexion en cache, remplacer le fichier + purger WAL/SHM.
      closeTenantDb(ctx.env.dataDir, userId);
      const target = tenantDbPath(ctx.env.dataDir, userId);
      fs.copyFileSync(tmp, target);
      fs.rmSync(`${target}-wal`, { force: true });
      fs.rmSync(`${target}-shm`, { force: true });
      // Réouverture immédiate : applique les migrations manquantes si besoin.
      openTenantDb(ctx.env.dataDir, userId);
      const user = c.get("user");
      recordSecurityEvent(ctx.adminDb, {
        action: "RESTORE_DATABASE",
        userId: user.id,
        login: user.login,
        ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
        success: true,
        detail: JSON.stringify({ bytes: buffer.length }),
      });
      return c.json({ ok: true });
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  // ============ VÉRIFICATION (proxy vers l'API AAS) ============

  // Vérification d'attestation : réservée aux comptes validés par un admin.
  app.get(
    "/verify/:immatriculation",
    requireApproved(ctx.env.adminContactEmail),
    verificationHandler,
  );
}

/**
 * Middleware : plafonne le débit des mutations pour un utilisateur connecté.
 * Les méthodes sûres (lecture) ne sont jamais limitées.
 */
function mutationRateLimit(limiter: SlidingWindowLimiter): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method.toUpperCase())) return next();
    const key = `u:${c.get("user").id}`;
    if (!limiter.hit(key)) {
      return c.json({ error: "Trop de requêtes. Réessayez dans un instant." }, 429);
    }
    await next();
  };
}

/** API métier de l'utilisateur connecté (isolation par tenant). */
export function apiRoutes(ctx: AppContext, mutationLimiter: SlidingWindowLimiter): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("*", requireAuth(ctx.adminDb, ctx.env.cookieSecure));
  app.use("*", requireCsrf);
  app.use("*", mutationRateLimit(mutationLimiter));
  registerBusinessRoutes(app, ctx, (c) => selfDb(ctx, c), { includeOperations: true });
  return app;
}

/**
 * API métier cross-tenant réservée aux ADMIN, montée sous
 * `/api/admin/tenants/:userId`. L'admin lit et modifie les données de
 * n'importe quel utilisateur ; chaque mutation est journalisée.
 */
export function adminTenantRoutes(
  ctx: AppContext,
  mutationLimiter: SlidingWindowLimiter,
): Hono<AdminTenantEnv> {
  const app = new Hono<AdminTenantEnv>();

  app.use("*", requireAuth(ctx.adminDb, ctx.env.cookieSecure));
  app.use("*", requireAdmin);
  app.use("*", requireCsrf);

  // Résout et valide l'utilisateur cible depuis le chemin ; journalise les
  // mutations cross-tenant (qui a touché la base de qui).
  app.use("*", async (c, next) => {
    const match = c.req.path.match(/\/api\/admin\/tenants\/(\d+)(?:\/|$)/);
    const targetId = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return c.json({ error: "Utilisateur cible invalide" }, 400);
    }
    const target = findUserById(ctx.adminDb, targetId);
    if (!target) return c.json({ error: "Utilisateur introuvable" }, 404);

    c.set("targetUserId", targetId);
    c.set("targetUser", toSafeUser(target));

    if (!SAFE_METHODS.has(c.req.method.toUpperCase())) {
      const actor = c.get("user");
      recordSecurityEvent(ctx.adminDb, {
        action: "ADMIN_TENANT_WRITE",
        userId: actor.id,
        login: actor.login,
        ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
        success: true,
        detail: JSON.stringify({
          targetUserId: targetId,
          method: c.req.method,
          path: c.req.path,
        }),
      });
    }
    await next();
  });

  app.use("*", mutationRateLimit(mutationLimiter) as unknown as MiddlewareHandler<AdminTenantEnv>);

  registerBusinessRoutes(
    app as unknown as Hono<AuthEnv>,
    ctx,
    (c) => openTenantChecked(ctx, (c as unknown as Context<AdminTenantEnv>).get("targetUserId")),
    { includeOperations: false },
  );

  return app;
}
