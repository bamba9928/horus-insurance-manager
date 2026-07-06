/**
 * Point d'entrée du serveur Horus.
 * Au premier démarrage : crée le compte super admin (mot de passe depuis
 * ADMIN_PASSWORD, sinon généré et affiché une seule fois en console).
 */

import crypto from "node:crypto";
import { serve } from "@hono/node-server";
import { buildApp } from "./app.js";
import { hashPassword } from "./auth/password.js";
import { LoginRateLimiter } from "./auth/rateLimit.js";
import { purgeExpiredSessions } from "./auth/sessions.js";
import { createUser, ensureUserEmailForLogin, openAdminDb } from "./db/adminDb.js";
import { closeAllTenantDbs, provisionTenantDb } from "./db/tenants.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const adminDb = openAdminDb(env.dataDir);
ensureUserEmailForLogin(adminDb, env.adminLogin, env.adminEmail);

// ── Bootstrap super admin au premier démarrage ──
const hasAdmin = adminDb.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();
if (!hasAdmin) {
  const password = env.adminPassword ?? crypto.randomBytes(12).toString("base64url");
  const adminId = createUser(adminDb, {
    login: env.adminEmail,
    nom: "Super administrateur",
    email: env.adminEmail,
    passwordHash: await hashPassword(password),
    role: "ADMIN",
  });
  provisionTenantDb(env.dataDir, adminId);

  console.log("═".repeat(60));
  console.log(`Compte super admin créé : ${env.adminEmail}`);
  if (!env.adminPassword) {
    console.log(`Mot de passe généré : ${password}`);
    console.log("⚠ Notez-le maintenant, il ne sera plus jamais affiché.");
  }
  console.log("═".repeat(60));
}

const rateLimiter = new LoginRateLimiter();

// ── Entretien horaire : purge des sessions expirées + fenêtres de rate limit ──
const maintenanceTimer = setInterval(() => {
  purgeExpiredSessions(adminDb);
  rateLimiter.sweep();
}, 3600_000);

const app = buildApp({ env, adminDb, rateLimiter });

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`Horus server démarré sur http://localhost:${info.port}`);
  console.log(`Données : ${env.dataDir}`);
});

// ── Arrêt propre (redéploiement VPS) : on cesse d'accepter, on ferme la base ──
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} reçu — arrêt en cours...`);
  clearInterval(maintenanceTimer);
  server.close(() => {
    closeAllTenantDbs();
    adminDb.close();
    console.log("Arrêt terminé.");
    process.exit(0);
  });
  // Filet de sécurité si des connexions traînent
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
