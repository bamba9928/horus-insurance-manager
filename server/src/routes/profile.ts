/**
 * Routes profil utilisateur : lecture, mise à jour des informations du compte
 * et changement du mot de passe par l'utilisateur connecté.
 *
 * @module routes/profile
 */

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import type { AppContext } from "../app.js";
import { requireCsrf } from "../auth/csrf.js";
import type { AuthEnv } from "../auth/middleware.js";
import { requireAuth } from "../auth/middleware.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { deleteOtherUserSessions, SESSION_COOKIE } from "../auth/sessions.js";
import {
  findUserById,
  recordSecurityEvent,
  toSafeUser,
  updateUserPassword,
  updateUserProfile,
} from "../db/adminDb.js";

function optionalText(max: number) {
  return z
    .preprocess((value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }, z.string().max(max).optional())
    .transform((value) => value ?? null);
}

const optionalEmail = z
  .preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().email("Email invalide").max(200).optional())
  .transform((value) => value ?? null);

const profileSchema = z.object({
  nom: z.string().trim().min(2, "Nom trop court").max(200, "Nom trop long"),
  prenom: optionalText(200),
  adresse: optionalText(500),
  telephone1: optionalText(50),
  telephone2: optionalText(50),
  email: optionalEmail,
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis").max(200),
  password: z.string().min(8, "8 caractères minimum").max(200),
});

function clientIp(header: string | undefined): string {
  return header?.split(",")[0]?.trim() || "local";
}

export function profileRoutes(ctx: AppContext): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.use("*", requireAuth(ctx.adminDb, ctx.env.cookieSecure));
  app.use("*", requireCsrf);

  app.get("/", (c) => c.json({ user: c.get("user") }));

  app.patch("/", async (c) => {
    const parsed = profileSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, 400);
    }

    const user = c.get("user");
    updateUserProfile(ctx.adminDb, user.id, parsed.data);
    const updated = findUserById(ctx.adminDb, user.id);
    if (!updated) return c.json({ error: "Utilisateur introuvable" }, 404);

    recordSecurityEvent(ctx.adminDb, {
      action: "PROFILE_UPDATE",
      userId: user.id,
      login: user.login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
    });

    return c.json({ user: toSafeUser(updated) });
  });

  app.post("/password", async (c) => {
    const parsed = passwordSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, 400);
    }

    const user = c.get("user");

    // Limite les essais de "mot de passe actuel" par compte : une session
    // volée (XSS, poste partagé) ne doit pas permettre de le deviner par
    // force brute puisqu'elle contourne déjà l'authentification initiale.
    const limiterKey = `profile-password:${user.id}`;
    if (ctx.rateLimiter.isBlocked(limiterKey)) {
      return c.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, 429);
    }

    const fullUser = findUserById(ctx.adminDb, user.id);
    if (!fullUser) return c.json({ error: "Utilisateur introuvable" }, 404);

    const valid = await verifyPassword(fullUser.password_hash, parsed.data.currentPassword);
    if (!valid) {
      ctx.rateLimiter.recordFailure(limiterKey);
      recordSecurityEvent(ctx.adminDb, {
        action: "PROFILE_PASSWORD_CHANGE",
        userId: user.id,
        login: user.login,
        ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
        success: false,
      });
      return c.json({ error: "Mot de passe actuel incorrect" }, 400);
    }
    ctx.rateLimiter.reset(limiterKey);

    updateUserPassword(ctx.adminDb, user.id, await hashPassword(parsed.data.password));
    const currentToken = getCookie(c, SESSION_COOKIE);
    if (currentToken) deleteOtherUserSessions(ctx.adminDb, user.id, currentToken);

    recordSecurityEvent(ctx.adminDb, {
      action: "PROFILE_PASSWORD_CHANGE",
      userId: user.id,
      login: user.login,
      ip: clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip")),
      success: true,
    });

    return c.json({ ok: true });
  });

  return app;
}
