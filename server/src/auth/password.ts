/**
 * Hachage des mots de passe — argon2id (recommandations OWASP).
 *
 * @module auth/password
 */

import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 Mio
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: string | null = null;

/**
 * Hash factice : vérifié quand le login n'existe pas, pour que le temps de
 * réponse ne révèle pas l'existence d'un compte (anti-énumération).
 */
export async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await hashPassword("horus-dummy-password-timing");
  }
  return dummyHash;
}
