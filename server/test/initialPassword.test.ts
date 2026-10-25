/**
 * Mot de passe initial du super admin : écrit dans DATA_DIR (0600), jamais
 * dans la console, et supprimé à la première connexion d'un super admin.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  initialPasswordPath,
  removeInitialPassword,
  writeInitialPassword,
} from "../src/auth/initialPassword.js";
import { hashPassword } from "../src/auth/password.js";
import { LoginRateLimiter } from "../src/auth/rateLimit.js";
import { createUser, openAdminDb } from "../src/db/adminDb.js";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "horus-initial-password-"));
});

afterEach(() => {
  // Windows : les fichiers WAL peuvent rester verrouillés un court instant
  fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe("fichier du mot de passe initial", () => {
  it("écrit le mot de passe dans DATA_DIR, lisible par le seul propriétaire", () => {
    const file = writeInitialPassword(dataDir, "secret-genere");
    expect(file).toBe(initialPasswordPath(dataDir));
    expect(fs.readFileSync(file, "utf8")).toBe("secret-genere\n");
    // Windows n'applique pas les bits de mode POSIX.
    if (process.platform !== "win32") {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it("remplace le fichier d'un bootstrap précédent", () => {
    writeInitialPassword(dataDir, "ancien");
    writeInitialPassword(dataDir, "nouveau");
    expect(fs.readFileSync(initialPasswordPath(dataDir), "utf8")).toBe("nouveau\n");
  });

  it("ne supprime qu'une fois", () => {
    writeInitialPassword(dataDir, "secret-genere");
    expect(removeInitialPassword(dataDir)).toBe(true);
    expect(removeInitialPassword(dataDir)).toBe(false);
    expect(fs.existsSync(initialPasswordPath(dataDir))).toBe(false);
  });
});

describe("connexion", () => {
  it("supprime le fichier à la connexion d'un super admin, pas d'un utilisateur", async () => {
    const adminDb = openAdminDb(dataDir);
    createUser(adminDb, {
      login: "admin@example.com",
      nom: "Super administrateur",
      email: "admin@example.com",
      passwordHash: await hashPassword("admin-password-123"),
      role: "ADMIN",
    });
    createUser(adminDb, {
      login: "agent@example.com",
      nom: "Agent",
      email: "agent@example.com",
      passwordHash: await hashPassword("agent-password-123"),
      role: "USER",
    });
    const app = buildApp({
      env: {
        port: 0,
        dataDir,
        cookieSecure: false,
        adminLogin: "admin",
        adminEmail: "admin@example.com",
        adminPassword: undefined,
        staticDir: undefined,
        publicSiteUrl: undefined,
        allowRegistration: true,
        adminContactEmail: "contact@horus-assur.digital",
      },
      adminDb,
      rateLimiter: new LoginRateLimiter(),
    });
    const login = (email: string, password: string) =>
      app.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: email, password }),
      });

    writeInitialPassword(dataDir, "admin-password-123");
    const file = initialPasswordPath(dataDir);

    expect((await login("admin@example.com", "mauvais")).status).toBe(401);
    expect(fs.existsSync(file)).toBe(true);

    expect((await login("agent@example.com", "agent-password-123")).status).toBe(200);
    expect(fs.existsSync(file)).toBe(true);

    expect((await login("admin@example.com", "admin-password-123")).status).toBe(200);
    expect(fs.existsSync(file)).toBe(false);

    adminDb.close();
  });
});
