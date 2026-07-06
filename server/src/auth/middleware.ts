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
import { CSRF_COOKIE, createCsrfToken, setCsrfCookie } from "./csrf.js";
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
    setCsrfCookie(
      c,
      getCookie(c, CSRF_COOKIE) ?? createCsrfToken(),
      cookieSecure,
      SESSION_MAX_AGE_SECONDS,
    );

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

/**
 * Exige un compte validé par un admin (à chaîner après requireAuth).
 * Un compte auto-inscrit peut se connecter mais reste bloqué sur les
 * fonctions sensibles tant qu'un admin ne l'a pas validé. La réponse porte
 * un code exploitable par le frontend + l'email de contact de l'admin.
 */
export function requireApproved(adminContactEmail: string): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    if (!c.get("user").approved) {
      return c.json(
        {
          error:
            "Votre compte est en attente de validation par un administrateur. " +
            `Contactez ${adminContactEmail} pour l'activation.`,
          code: "ACCOUNT_PENDING",
          adminEmail: adminContactEmail,
        },
        403,
      );
    }
    await next();
  };
}
