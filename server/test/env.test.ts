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
    expect(env.adminPassword).toBeUndefined();
    expect(env.staticDir).toBeUndefined();
    expect(env.cookieSecure).toBe(false);
  });
});
