/**
 * Service des fichiers statiques du frontend web + repli SPA (index.html).
 * Monté en dernier : les routes /api/* sont déjà gérées avant.
 *
 * @module routes/static
 */

import fs from "node:fs";
import path from "node:path";
import type { Hono } from "hono";
import type { AuthEnv } from "../auth/middleware.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/** Détecte un nom de fichier versionné (hash Vite) → cache long immuable. */
function isHashed(fileName: string): boolean {
  return /\.[0-9a-zA-Z_-]{8,}\.(js|css|woff2?|ttf|png|jpe?g|svg|webp)$/.test(fileName);
}

export function mountStatic(app: Hono<AuthEnv>, dir: string): void {
  const root = path.resolve(dir);
  const indexHtml = path.join(root, "index.html");

  app.get("/*", (c) => {
    if (c.req.path.startsWith("/api/")) return c.notFound();

    const rel = decodeURIComponent(c.req.path.replace(/^\/+/, ""));
    const candidate = path.resolve(root, rel);

    // Anti-traversée : le chemin résolu doit rester sous la racine.
    const withinRoot = candidate === root || candidate.startsWith(root + path.sep);

    let filePath = candidate;
    if (!withinRoot || rel === "" || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = indexHtml; // repli SPA
    }
    if (!fs.existsSync(filePath)) return c.notFound();

    const ext = path.extname(filePath).toLowerCase();
    const body = fs.readFileSync(filePath);
    const cacheControl =
      ext === ".html"
        ? "no-cache"
        : isHashed(path.basename(filePath))
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600";

    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": cacheControl,
      },
    });
  });
}
