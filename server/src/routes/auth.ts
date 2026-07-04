/**
 * Routes d'authentification : /api/auth/login, /api/auth/logout, /api/me.
 *
 * @module routes/auth
 */

import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppContext } from "../app.js";
import { CSRF_COOKIE, createCsrfToken, requireCsrf, setCsrfCookie } from "../auth/csrf.js";
import type { AuthEnv } from "../auth/middleware.js";
import { requireAuth } from "../auth/middleware.js";
import { getDummyHash, verifyPassword } from "../auth/password.js";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../auth/sessions.js";
import { findUserByLogin, recordSecurityEvent, toSafeUser, touchLastLogin } from "../db/adminDb.js";

const loginSchema = z.object({
  login: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

/** Clé de rate limiting : IP transmise par le reverse proxy, sinon locale. */
function clientKey(header: string | undefined): string {
  return header?.split(",")[0]?.trim() || "local";
}

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return clientKey(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"));
}

export function authRoutes(ctx: AppContext): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.post("/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Requête invalide" }, 400);

    const key = clientIp(c);
    if (ctx.rateLimiter.isBlocked(key)) {
      recordSecurityEvent(ctx.adminDb, {
        action: "LOGIN_BLOCKED",
        login: parsed.data.login,
        ip: key,
        success: false,
      });
      return c.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, 429);
    }

    const user = findUserByLogin(ctx.adminDb, parsed.data.login);
    let valid = false;
    if (user) {
      valid = await verifyPassword(user.password_hash, parsed.data.password);
    } else {
      // Vérification factice : temps de réponse constant, login inconnu ou non
      await verifyPassword(await getDummyHash(), parsed.data.password);
    }

    if (!user || !valid) {
      ctx.rateLimiter.recordFailure(key);
      recordSecurityEvent(ctx.adminDb, {
        action: "LOGIN_FAILURE",
        userId: user?.id ?? null,
        login: parsed.data.login,
        ip: key,
        success: false,
      });
      return c.json({ error: "Identifiants incorrects" }, 401);
    }
    if (!user.actif) {
      recordSecurityEvent(ctx.adminDb, {
        action: "LOGIN_FAILURE",
        userId: user.id,
        login: user.login,
        ip: key,
        success: false,
        detail: "Compte suspendu",
      });
      return c.json({ error: "Compte suspendu" }, 403);
    }

    ctx.rateLimiter.reset(key);
    const token = createSession(ctx.adminDb, user.id);
    const csrfToken = createCsrfToken();
    touchLastLogin(ctx.adminDb, user.id);
    recordSecurityEvent(ctx.adminDb, {
      action: "LOGIN_SUCCESS",
      userId: user.id,
      login: user.login,
      ip: key,
      success: true,
    });

    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: ctx.env.cookieSecure,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    setCsrfCookie(c, csrfToken, ctx.env.cookieSecure, SESSION_MAX_AGE_SECONDS);
    return c.json({ user: toSafeUser(user) });
  });

  app.post("/logout", requireAuth(ctx.adminDb, ctx.env.cookieSecure), requireCsrf, (c) => {
    const user = c.get("user");
    const token = getCookie(c, SESSION_COOKIE);
    if (token) deleteSession(ctx.adminDb, token);
    recordSecurityEvent(ctx.adminDb, {
      action: "LOGOUT",
      userId: user.id,
      login: user.login,
      ip: clientIp(c),
      success: true,
    });
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    deleteCookie(c, CSRF_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  return app;
}
