/**
 * Utilitaires CSRF pour le client web.
 *
 * @module csrf
 */

const CSRF_COOKIE = "horus_csrf";
export const CSRF_HEADER = "x-csrf-token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  const raw = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return raw ? decodeURIComponent(raw.slice(prefix.length)) : undefined;
}

export function csrfHeaders(method: string): Record<string, string> {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return {};
  const token = readCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}
