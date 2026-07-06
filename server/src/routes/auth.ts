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
import { getDummyHash, hashPassword, verifyPassword } from "../auth/password.js";
import type { SlidingWindowLimiter } from "../auth/rateLimit.js";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../auth/sessions.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByLogin,
  recordSecurityEvent,
  toSafeUser,
  touchLastLogin,
} from "../db/adminDb.js";
import { provisionTenantDb } from "../db/tenants.js";

const loginSchema = z.object({
  login: z.string().trim().email("Email invalide").max(200),
  password: z.string().min(1).max(200),
});

function requiredText(max: number, message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().min(1, message).max(max),
  );
}

const registerSchema = z
  .object({
    nom: z.string().trim().min(2, "Nom trop court").max(200),
    prenom: z.string().trim().max(200).optional(),
    email: z.string().trim().email("Email invalide").max(200),
    telephone1: requiredText(50, "Téléphone obligatoire"),
    password: z.string().min(8, "8 caractères minimum").max(200),
    passwordConfirm: z.string().max(200).optional(),
    website: z.string().trim().max(0, "Requête invalide").optional(),
  })
  .refine((data) => data.passwordConfirm == null || data.password === data.passwordConfirm, {
    message: "La confirmation du mot de passe ne correspond pas",
    path: ["passwordConfirm"],
  });

/** Clé de rate limiting : IP transmise par le reverse proxy, sinon locale. */
function clientKey(header: string | undefined): string {
  return header?.split(",")[0]?.trim() || "local";
}

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return clientKey(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"));
}

export function authRoutes(
  ctx: AppContext,
  registrationLimiter: SlidingWindowLimiter,
): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  /**
   * Auto-inscription publique. La session est ouverte immédiatement pour une
   * expérience fluide ; l'email sert d'identifiant technique.
   */
  app.post("/register", async (c) => {
    if (!ctx.env.allowRegistration) {
      return c.json({ error: "Les inscriptions sont désactivées." }, 403);
    }

    const key = clientIp(c);
    if (!registrationLimiter.hit(`register:${key}`)) {
      return c.json({ error: "Trop de tentatives d'inscription. Réessayez plus tard." }, 429);
    }

    const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, 400);
    }

    const accountLogin = parsed.data.email;

    if (
      findUserByLogin(ctx.adminDb, accountLogin) ||
      findUserByEmail(ctx.adminDb, parsed.data.email)
    ) {
      return c.json({ error: "Cet email est déjà utilisé." }, 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    let userId: number;
    try {
      userId = createUser(ctx.adminDb, {
        login: accountLogin,
        nom: parsed.data.nom,
        prenom: parsed.data.prenom ?? null,
        telephone1: parsed.data.telephone1 ?? null,
        email: parsed.data.email,
        passwordHash,
        role: "USER",
        approved: false,
      });
    } catch (err) {
      if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        return c.json({ error: "Cet email est déjà utilisé." }, 409);
      }
      throw err;
    }
    provisionTenantDb(ctx.env.dataDir, userId);

    recordSecurityEvent(ctx.adminDb, {
      action: "USER_REGISTER",
      userId,
      login: accountLogin,
      ip: key,
      success: true,
    });

    const token = createSession(ctx.adminDb, userId);
    const csrfToken = createCsrfToken();
    touchLastLogin(ctx.adminDb, userId);

    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: ctx.env.cookieSecure,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    setCsrfCookie(c, csrfToken, ctx.env.cookieSecure, SESSION_MAX_AGE_SECONDS);

    const user = findUserById(ctx.adminDb, userId);
    return c.json({ user: user ? toSafeUser(user) : null }, 201);
  });

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

    const user = findUserByEmail(ctx.adminDb, parsed.data.login);
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
    // Rotation : invalide le jeton présenté (le cas échéant) avant d'en émettre
    // un neuf — évite la fixation de session et repart d'un identifiant propre.
    const presented = getCookie(c, SESSION_COOKIE);
    if (presented) deleteSession(ctx.adminDb, presented);
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
