/**
 * Wrapper typé autour de tauri-plugin-sql.
 * Fournit un accès simplifié à la base SQLite via l'IPC Tauri.
 *
 * @module db
 */

import Database from "@tauri-apps/plugin-sql";

/** Nom de la source de données SQLite */
const DB_NAME = "sqlite:assurauto.db";

/** Instance singleton de la connexion DB */
let dbInstance: Database | null = null;

/**
 * Retourne l'instance de connexion SQLite (singleton).
 * Initialise la connexion au premier appel.
 */
export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME);
  }
  return dbInstance;
}

/**
 * Résultat générique d'une requête SELECT.
 * Utiliser un type plus spécifique selon le contexte.
 */
export type QueryResult<T = Record<string, unknown>> = T[];

/**
 * Exécute une requête SELECT et retourne les résultats typés.
 *
 * @param query - Requête SQL paramétrée (ex: "SELECT * FROM clients WHERE id = ?")
 * @param bindValues - Valeurs des paramètres positionnels
 * @returns Tableau de résultats typés
 */
export async function select<T = Record<string, unknown>>(
  query: string,
  bindValues: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(query, bindValues);
}

/**
 * Résultat d'une commande INSERT/UPDATE/DELETE.
 */
export interface ExecuteResult {
  /** Nombre de lignes affectées */
  rowsAffected: number;
  /** ID de la dernière ligne insérée (INSERT uniquement) */
  lastInsertId?: number;
}

/**
 * Exécute une commande SQL (INSERT, UPDATE, DELETE).
 *
 * @param query - Requête SQL paramétrée
 * @param bindValues - Valeurs des paramètres positionnels
 * @returns Nombre de lignes affectées et dernier ID inséré
 */
export async function execute(query: string, bindValues: unknown[] = []): Promise<ExecuteResult> {
  const db = await getDb();
  return db.execute(query, bindValues);
}

/**
 * Exécute plusieurs requêtes dans une transaction.
 * Rollback automatique en cas d'erreur.
 *
 * @param operations - Fonction async recevant les helpers execute/select
 */
export async function transaction<T>(
  operations: (helpers: { execute: typeof execute; select: typeof select }) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  await db.execute("BEGIN TRANSACTION");
  try {
    const result = await operations({ execute, select });
    await db.execute("COMMIT");
    return result;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
