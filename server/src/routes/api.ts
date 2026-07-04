/**
 * API métier REST. Toutes les routes sont derrière requireAuth et opèrent
 * sur la base SQLite de l'utilisateur connecté (isolation par tenant).
 *
 * @module routes/api
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app.js";
import { requireCsrf } from "../auth/csrf.js";
import type { AuthEnv } from "../auth/middleware.js";
import { requireAuth } from "../auth/middleware.js";
import { recordSecurityEvent } from "../db/adminDb.js";
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

/** Récupère la base de l'utilisateur courant (connexion mise en cache). */
function tenantDb(ctx: AppContext, c: Context<AuthEnv>) {
  return openTenantDb(ctx.env.dataDir, c.get("user").id);
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

export function apiRoutes(ctx: AppContext): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("*", requireAuth(ctx.adminDb, ctx.env.cookieSecure));
  app.use("*", requireCsrf);

  // ============ CLIENTS ============

  app.get("/clients", (c) => {
    const parsed = listClientsQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) return c.json({ error: "Paramètres invalides" }, 400);
    return c.json(q.listClients(tenantDb(ctx, c), parsed.data));
  });

  app.get("/clients/count", (c) => {
    const search = c.req.query("search");
    return c.json({ count: q.countClients(tenantDb(ctx, c), search) });
  });

  app.get("/clients/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const client = q.getClient(tenantDb(ctx, c), id);
    return client ? c.json(client) : c.json({ error: "Introuvable" }, 404);
  });

  app.post("/clients", async (c) => {
    const parsed = clientCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createClient(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json({ id: res }, 201);
  });

  app.patch("/clients/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const parsed = clientUpdateSchema.safeParse({ ...(await c.req.json().catch(() => ({}))), id });
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.updateClient(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/clients/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deleteClient(tenantDb(ctx, c), id);
    return c.json({ ok: true });
  });

  // ============ VÉHICULES ============

  app.get("/vehicules", (c) => {
    const clientId = c.req.query("clientId");
    const parsedId = clientId ? parseId(clientId) : undefined;
    if (clientId && parsedId == null) return c.json({ error: "clientId invalide" }, 400);
    return c.json(q.listVehicules(tenantDb(ctx, c), parsedId ?? undefined));
  });

  app.get("/vehicules/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const veh = q.getVehicule(tenantDb(ctx, c), id);
    return veh ? c.json(veh) : c.json({ error: "Introuvable" }, 404);
  });

  app.post("/vehicules", async (c) => {
    const parsed = vehiculeCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createVehicule(tenantDb(ctx, c), parsed.data));
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
    const res = guardMutation(c, () => q.updateVehicule(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/vehicules/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deleteVehicule(tenantDb(ctx, c), id);
    return c.json({ ok: true });
  });

  // ============ ASSUREURS ============

  app.get("/assureurs", (c) => c.json(q.listAssureurs(tenantDb(ctx, c))));

  app.post("/assureurs", async (c) => {
    const parsed = assureurCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createAssureur(tenantDb(ctx, c), parsed.data));
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
    const res = guardMutation(c, () => q.updateAssureur(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/assureurs/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deleteAssureur(tenantDb(ctx, c), id);
    return c.json({ ok: true });
  });

  // ============ INTÉGRATIONS ============

  app.get("/integrations/overview", (c) => c.json(q.listIntegrationOverview(tenantDb(ctx, c))));

  app.get("/integrations/logs", (c) => {
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
    const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 500 ? limit : 20;
    return c.json(q.listIntegrationExchangeLogs(tenantDb(ctx, c), safeLimit));
  });

  app.post("/integrations/:id/test", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    try {
      q.testAssureurIntegration(tenantDb(ctx, c), id);
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
    return c.json(q.listPolices(tenantDb(ctx, c), parsed.data));
  });

  app.get("/polices/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const police = q.getPolice(tenantDb(ctx, c), id);
    return police ? c.json(police) : c.json({ error: "Introuvable" }, 404);
  });

  app.post("/polices", async (c) => {
    const parsed = policeCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createPolice(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json({ id: res }, 201);
  });

  app.patch("/polices/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    const parsed = policeUpdateSchema.safeParse({ ...(await c.req.json().catch(() => ({}))), id });
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.updatePolice(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/polices/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deletePolice(tenantDb(ctx, c), id);
    return c.json({ ok: true });
  });

  app.post("/polices/:id/renew", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    try {
      return c.json({ id: q.renewPolice(tenantDb(ctx, c), id) }, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // ============ PAIEMENTS ============

  app.get("/paiements", (c) => {
    const policeId = c.req.query("policeId");
    const parsedId = policeId ? parseId(policeId) : undefined;
    if (policeId && parsedId == null) return c.json({ error: "policeId invalide" }, 400);
    return c.json(q.listPaiements(tenantDb(ctx, c), parsedId ?? undefined));
  });

  app.post("/paiements", async (c) => {
    const parsed = paiementCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createPaiement(tenantDb(ctx, c), parsed.data));
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
    const res = guardMutation(c, () => q.updatePaiement(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json({ ok: true });
  });

  app.delete("/paiements/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "Identifiant invalide" }, 400);
    q.deletePaiement(tenantDb(ctx, c), id);
    return c.json({ ok: true });
  });

  // ============ DOSSIER COMPLET ============

  app.post("/dossiers", async (c) => {
    const parsed = dossierCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Données invalides" }, 400);
    const res = guardMutation(c, () => q.createDossier(tenantDb(ctx, c), parsed.data));
    return res instanceof Response ? res : c.json(res, 201);
  });

  // ============ DASHBOARD ============

  app.get("/dashboard/kpi", (c) => c.json(q.getDashboardKPI(tenantDb(ctx, c))));
  app.get("/dashboard/echeances30j", (c) => c.json(q.getEcheances30j(tenantDb(ctx, c))));
  app.get("/dashboard/impayes", (c) => c.json(q.getImpayes(tenantDb(ctx, c))));
  app.get("/dashboard/recap", (c) => c.json(q.getDashboardRecap(tenantDb(ctx, c))));

  app.get("/dashboard/echeances-range", (c) => {
    const parsed = echeancesRangeQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) return c.json({ error: "Paramètres invalides" }, 400);
    return c.json(q.getEcheancesRange(tenantDb(ctx, c), parsed.data));
  });

  // ============ SAUVEGARDE / RESTAURATION ============

  const MAX_RESTORE_BYTES = 200 * 1024 * 1024;

  /** Télécharge une copie cohérente de la base de l'utilisateur. */
  app.get("/backup", async (c) => {
    const db = tenantDb(ctx, c);
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

  // ============ VÉRIFICATION (proxy) ============

  const verifyParamSchema = z.string().min(1).max(20);

  app.get("/verify/:immatriculation", (c) => {
    const parsed = verifyParamSchema.safeParse(c.req.param("immatriculation"));
    if (!parsed.success) return c.json({ error: "Immatriculation invalide" }, 400);
    // Connecteur réel non implémenté (comme le mode MANUAL desktop).
    return c.json({
      operationStatus: "ERROR",
      operationMessage: "Vérification en ligne non disponible pour le moment.",
      data: null,
    });
  });

  return app;
}
