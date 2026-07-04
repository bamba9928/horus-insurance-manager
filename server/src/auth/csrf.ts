/**
 * Protection CSRF double-submit pour les sessions par cookie.
 *
 * Le cookie de session reste httpOnly. Le cookie CSRF est lisible par le
 * frontend same-origin, qui doit renvoyer sa valeur dans l'en-tête
 * `x-csrf-token` sur les mutations.
 *
 * @module auth/csrf
 */

import crypto from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";

export const CSRF_COOKIE = "horus_csrf";
export const CSRF_HEADER = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function setCsrfCookie(
  c: Parameters<typeof setCookie>[0],
  token: string,
  cookieSecure: boolean,
  maxAge: number,
): void {
  setCookie(c, CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "Lax",
    secure: cookieSecure,
    path: "/",
    maxAge,
  });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Exige un token CSRF sur les méthodes qui modifient l'état. */
export const requireCsrf: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method.toUpperCase())) {
    await next();
    return;
  }

  const cookieToken = getCookie(c, CSRF_COOKIE);
  const headerToken = c.req.header(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return c.json({ error: "Jeton CSRF invalide" }, 403);
  }

  await next();
};
