/**
 * Tests de loadEnv : garde contre la régression où une variable
 * d'environnement vide ("ADMIN_PASSWORD=" dans .env, propagée telle quelle
 * par Docker Compose) était traitée comme un mot de passe vide au lieu
 * d'« absent ».
 */

import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  it("traite une chaîne vide comme absente pour ADMIN_PASSWORD", () => {
    const env = loadEnv({ ADMIN_PASSWORD: "" });
    expect(env.adminPassword).toBeUndefined();
  });

  it("garde un mot de passe explicite", () => {
    const env = loadEnv({ ADMIN_PASSWORD: "un-mot-de-passe" });
    expect(env.adminPassword).toBe("un-mot-de-passe");
  });

  it("traite une chaîne vide comme absente pour ADMIN_LOGIN (retombe sur 'admin')", () => {
    const env = loadEnv({ ADMIN_LOGIN: "" });
    expect(env.adminLogin).toBe("admin");
  });

  it("utilise le login explicite quand fourni", () => {
    const env = loadEnv({ ADMIN_LOGIN: "superadmin" });
    expect(env.adminLogin).toBe("superadmin");
  });

  it("valeurs par défaut cohérentes quand rien n'est fourni", () => {
    const env = loadEnv({});
    expect(env.port).toBe(3000);
    expect(env.adminLogin).toBe("admin");
    expect(env.adminEmail).toBe("contact@horus-assur.digital");
    expect(env.adminPassword).toBeUndefined();
    expect(env.staticDir).toBeUndefined();
    expect(env.cookieSecure).toBe(false);
    expect(env.allowRegistration).toBe(true);
    expect(env.adminContactEmail).toBe("contact@horus-assur.digital");
  });

  it("utilise ADMIN_EMAIL pour l'email de connexion admin", () => {
    const env = loadEnv({ ADMIN_EMAIL: "admin@example.com" });
    expect(env.adminEmail).toBe("admin@example.com");
    expect(env.adminContactEmail).toBe("admin@example.com");
  });

  it("désactive l'inscription quand ALLOW_REGISTRATION=false", () => {
    expect(loadEnv({ ALLOW_REGISTRATION: "false" }).allowRegistration).toBe(false);
    expect(loadEnv({ ALLOW_REGISTRATION: "true" }).allowRegistration).toBe(true);
  });
});
