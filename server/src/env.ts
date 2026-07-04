/**
 * Configuration du serveur via variables d'environnement.
 *
 * @module env
 */

import path from "node:path";

export interface ServerEnv {
  /** Port HTTP (défaut : 3000) */
  port: number;
  /** Répertoire des données : admin.db + tenants/user_<id>.db */
  dataDir: string;
  /** Cookie `Secure` (activé en production, derrière HTTPS) */
  cookieSecure: boolean;
  /** Login du super admin créé au premier démarrage */
  adminLogin: string;
  /** Mot de passe du super admin (généré aléatoirement si absent) */
  adminPassword: string | undefined;
  /** Répertoire du frontend web à servir (statique + SPA). Absent = API seule. */
  staticDir: string | undefined;
}

export function loadEnv(processEnv: NodeJS.ProcessEnv = process.env): ServerEnv {
  return {
    port: Number(processEnv.PORT ?? 3000),
    dataDir: path.resolve(processEnv.DATA_DIR ?? "data"),
    // Cookie Secure : activé en production, forçable via COOKIE_SECURE
    // (utile derrière un reverse proxy qui termine le TLS).
    cookieSecure:
      processEnv.COOKIE_SECURE != null
        ? processEnv.COOKIE_SECURE === "true"
        : processEnv.NODE_ENV === "production",
    adminLogin: processEnv.ADMIN_LOGIN || "admin",
    // Une chaîne vide (ex: "ADMIN_PASSWORD=" dans .env, propagée telle quelle
    // par Docker Compose) doit être traitée comme "absent", pas comme un
    // mot de passe vide.
    adminPassword: processEnv.ADMIN_PASSWORD || undefined,
    staticDir: processEnv.STATIC_DIR ? path.resolve(processEnv.STATIC_DIR) : undefined,
  };
}
