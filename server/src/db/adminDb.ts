/**
 * Base d'administration (admin.db) : comptes utilisateurs et sessions.
 * Les données métier de chaque utilisateur vivent dans leur propre
 * fichier SQLite (voir tenants.ts) — jamais ici.
 *
 * @module db/adminDb
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Role = "ADMIN" | "USER";

/** Ligne complète de la table users (usage interne uniquement). */
export interface UserRow {
  id: number;
  login: string;
  nom: string;
  password_hash: string;
  role: Role;
  actif: 0 | 1;
  created_at: string;
  last_login_at: string | null;
}

/** Utilisateur sans données sensibles (exposé à l'API). */
export interface SafeUser {
  id: number;
  login: string;
  nom: string;
  role: Role;
}

export type SecurityAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGIN_BLOCKED"
  | "LOGOUT"
  | "USER_CREATE"
  | "USER_PASSWORD_RESET"
  | "USER_ACTIVE_CHANGE"
  | "BACKUP_DATABASE"
  | "RESTORE_DATABASE";

export function toSafeUser(row: UserRow): SafeUser {
  return { id: row.id, login: row.login, nom: row.nom, role: row.role };
}

const ADMIN_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  login         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nom           TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('ADMIN','USER')),
  actif         INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS security_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  login      TEXT,
  action     TEXT NOT NULL,
  ip         TEXT,
  success    INTEGER NOT NULL CHECK(success IN (0,1)),
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user    ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_action  ON security_events(action);
`;

/** Ouvre (et initialise si besoin) la base d'administration. */
export function openAdminDb(dataDir: string): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "admin.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(ADMIN_SCHEMA);
  return db;
}

// ============ Requêtes utilisateurs ============

export function findUserByLogin(db: Database.Database, login: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE login = ?").get(login) as UserRow | undefined;
}

export function findUserById(db: Database.Database, id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

/** Liste des utilisateurs sans le hash de mot de passe. */
export function listUsers(db: Database.Database): Omit<UserRow, "password_hash">[] {
  return db
    .prepare(
      "SELECT id, login, nom, role, actif, created_at, last_login_at FROM users ORDER BY login",
    )
    .all() as Omit<UserRow, "password_hash">[];
}

export function createUser(
  db: Database.Database,
  data: { login: string; nom: string; passwordHash: string; role: Role },
): number {
  const result = db
    .prepare("INSERT INTO users (login, nom, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(data.login, data.nom, data.passwordHash, data.role);
  return Number(result.lastInsertRowid);
}

export function updateUserPassword(
  db: Database.Database,
  userId: number,
  passwordHash: string,
): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

export function setUserActive(db: Database.Database, userId: number, actif: boolean): void {
  db.prepare("UPDATE users SET actif = ? WHERE id = ?").run(actif ? 1 : 0, userId);
}

export function touchLastLogin(db: Database.Database, userId: number): void {
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    userId,
  );
}

export function recordSecurityEvent(
  db: Database.Database,
  event: {
    action: SecurityAction;
    success: boolean;
    userId?: number | null;
    login?: string | null;
    ip?: string | null;
    detail?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO security_events (user_id, login, action, ip, success, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    event.userId ?? null,
    event.login ?? null,
    event.action,
    event.ip ?? null,
    event.success ? 1 : 0,
    event.detail ?? null,
  );
}
