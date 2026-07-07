/**
 * Assemblage de l'application Hono (séparé du point d'entrée pour les tests).
 *
 * @module app
 */

import type Database from "better-sqlite3";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AuthEnv } from "./auth/middleware.js";
import { requireAuth } from "./auth/middleware.js";
import type { LoginRateLimiter } from "./auth/rateLimit.js";
import { SlidingWindowLimiter } from "./auth/rateLimit.js";
import type { ServerEnv } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
import { adminTenantRoutes, apiRoutes } from "./routes/api.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { mountStatic } from "./routes/static.js";

export interface AppContext {
  env: ServerEnv;
  adminDb: Database.Database;
  rateLimiter: LoginRateLimiter;
}

export function buildApp(ctx: AppContext): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  // Limiteur partagé des mutations métier (self + admin cross-tenant).
  const mutationLimiter = new SlidingWindowLimiter();
  // Limiteur d'auto-inscription (par IP) : quelques comptes par fenêtre.
  const registrationLimiter = new SlidingWindowLimiter(5, 10 * 60_000);

  app.onError((err, c) => {
    console.error(`[erreur] ${c.req.method} ${c.req.path}:`, err);
    return c.json({ error: "Erreur interne du serveur" }, 500);
  });

  // En-têtes de sécurité globaux. Anti-cache sur /api pour éviter qu'un proxy
  // ou le navigateur ne conserve des données personnelles d'un tenant.
  app.use("*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Permitted-Cross-Domain-Policies", "none");
    if (c.req.path.startsWith("/api/")) c.header("Cache-Control", "no-store");
    await next();
  });

  // Anti-DoS : plafonne les corps JSON (256 Kio largement suffisant pour les
  // payloads métier). La restauration de base (fichier SQLite volumineux) a
  // son propre plafond, appliqué dans sa route.
  const jsonBodyLimit = bodyLimit({
    maxSize: 256 * 1024,
    onError: (c) => c.json({ error: "Requête trop volumineuse" }, 413),
  });
  app.use("/api/*", (c, next) => {
    if (c.req.path === "/api/restore") return next();
    return jsonBodyLimit(c, next);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  // Config publique consommée par la page de connexion / d'inscription.
  app.get("/api/config", (c) =>
    c.json({
      registrationEnabled: ctx.env.allowRegistration,
      adminEmail: ctx.env.adminContactEmail,
    }),
  );

  app.route("/api/auth", authRoutes(ctx, registrationLimiter));
  app.route("/api/profile", profileRoutes(ctx));

  app.get("/api/me", requireAuth(ctx.adminDb, ctx.env.cookieSecure), (c) =>
    c.json({ user: c.get("user") }),
  );

  // L'API admin cross-tenant doit être montée AVANT `/api/admin` (routes de
  // gestion des comptes) et `/api` (isolation), sinon un montage plus large
  // capterait ses requêtes.
  app.route("/api/admin/tenants/:userId", adminTenantRoutes(ctx, mutationLimiter));
  app.route("/api/admin", adminRoutes(ctx));
  app.route("/api", apiRoutes(ctx, mutationLimiter));

  // Frontend web servi par le même process (déploiement en un seul conteneur).
  if (ctx.env.staticDir) {
    mountStatic(app, ctx.env.staticDir, { publicSiteUrl: ctx.env.publicSiteUrl });
  }

  return app;
}
