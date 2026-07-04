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
import type { ServerEnv } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
import { apiRoutes } from "./routes/api.js";
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

  app.onError((err, c) => {
    console.error(`[erreur] ${c.req.method} ${c.req.path}:`, err);
    return c.json({ error: "Erreur interne du serveur" }, 500);
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

  app.route("/api/auth", authRoutes(ctx));
  app.route("/api/profile", profileRoutes(ctx));

  app.get("/api/me", requireAuth(ctx.adminDb, ctx.env.cookieSecure), (c) =>
    c.json({ user: c.get("user") }),
  );

  app.route("/api/admin", adminRoutes(ctx));
  app.route("/api", apiRoutes(ctx));

  // Frontend web servi par le même process (déploiement en un seul conteneur).
  if (ctx.env.staticDir) {
    mountStatic(app, ctx.env.staticDir);
  }

  return app;
}
