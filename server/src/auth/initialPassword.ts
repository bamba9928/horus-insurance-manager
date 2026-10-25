/**
 * Mot de passe initial du super admin, quand ADMIN_PASSWORD n'est pas fourni.
 *
 * Il est écrit dans un fichier lisible par son seul propriétaire (0600) dans
 * DATA_DIR, jamais dans la console : la sortie d'un conteneur est conservée
 * (`docker compose logs`) et souvent collectée. Le fichier est supprimé à la
 * première connexion réussie d'un super admin.
 *
 * @module auth/initialPassword
 */

import fs from "node:fs";
import path from "node:path";

export const INITIAL_PASSWORD_FILE = "initial-admin-password.txt";

export function initialPasswordPath(dataDir: string): string {
  return path.join(dataDir, INITIAL_PASSWORD_FILE);
}

/** Écrit le mot de passe généré et renvoie le chemin du fichier. */
export function writeInitialPassword(dataDir: string, password: string): string {
  const file = initialPasswordPath(dataDir);
  // Reste d'un bootstrap précédent (base admin supprimée puis recréée) : remplacé.
  fs.rmSync(file, { force: true });
  // Création exclusive : le mode 0600 s'applique dès la création du fichier.
  fs.writeFileSync(file, `${password}\n`, { mode: 0o600, flag: "wx" });
  return file;
}

/** Supprime le fichier s'il existe ; renvoie true s'il a été supprimé. */
export function removeInitialPassword(dataDir: string): boolean {
  const file = initialPasswordPath(dataDir);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}
