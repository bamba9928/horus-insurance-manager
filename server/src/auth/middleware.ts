/**
 * Middlewares d'authentification Hono.
 *
 * @module auth/middleware
 */

import type Database from "better-sqlite3";
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { SafeUser } from "../db/adminDb.js";
import { toSafeUser } from "../db/adminDb.js";
import {
  deleteUserSessions,
  getSessionUser,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./sessions.js";

/** Variables de contexte injectées par requireAuth. */
export interface AuthVariables {
  user: SafeUser;
}

export type AuthEnv = { Variables: AuthVariables };

/**
 * Exige une session valide ; injecte `user` dans le contexte.
 * Ré-émet le cookie à chaque requête pour que la fenêtre de 7 jours glisse
 * réellement côté navigateur (sinon il expirerait 7 j après le login, même
 * pour un utilisateur actif — l'extension en base ne suffit pas).
 */
export function requireAuth(
  adminDb: Database.Database,
  cookieSecure: boolean,
): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return c.json({ error: "Authentification requise" }, 401);

    const user = getSessionUser(adminDb, token);
    if (!user) return c.json({ error: "Session expirée" }, 401);

    if (!user.actif) {
      deleteUserSessions(adminDb, user.id);
      return c.json({ error: "Compte suspendu" }, 403);
    }

    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: cookieSecure,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    c.set("user", toSafeUser(user));
    await next();
  };
}

/** Exige le rôle ADMIN (à chaîner après requireAuth). */
export const requireAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  if (c.get("user").role !== "ADMIN") {
    return c.json({ error: "Réservé à l'administrateur" }, 403);
  }
  await next();
};
