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
  prenom: string | null;
  adresse: string | null;
  telephone1: string | null;
  telephone2: string | null;
  email: string | null;
  password_hash: string;
  role: Role;
  actif: 0 | 1;
  /** 1 = compte validé par un admin ; 0 = auto-inscrit, en attente de validation. */
  approved: 0 | 1;
  created_at: string;
  last_login_at: string | null;
}

/** Utilisateur sans données sensibles (exposé à l'API). */
export interface SafeUser {
  id: number;
  login: string;
  nom: string;
  prenom: string | null;
  adresse: string | null;
  telephone1: string | null;
  telephone2: string | null;
  email: string | null;
  role: Role;
  /** Compte validé par un admin (accès complet). Faux = en attente. */
  approved: boolean;
}

export type SecurityAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGIN_BLOCKED"
  | "LOGOUT"
  | "PROFILE_UPDATE"
  | "PROFILE_PASSWORD_CHANGE"
  | "USER_CREATE"
  | "USER_PASSWORD_RESET"
  | "USER_ACTIVE_CHANGE"
  | "BACKUP_DATABASE"
  | "RESTORE_DATABASE"
  | "ADMIN_TENANT_WRITE"
  | "USER_REGISTER"
  | "USER_APPROVE";

export function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    login: row.login,
    nom: row.nom,
    prenom: row.prenom,
    adresse: row.adresse,
    telephone1: row.telephone1,
    telephone2: row.telephone2,
    email: row.email,
    role: row.role,
    approved: row.approved === 1,
  };
}

const ADMIN_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  login         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nom           TEXT NOT NULL,
  prenom        TEXT,
  adresse       TEXT,
  telephone1    TEXT,
  telephone2    TEXT,
  email         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('ADMIN','USER')),
  actif         INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  approved      INTEGER NOT NULL DEFAULT 1 CHECK(approved IN (0,1)),
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

const USER_PROFILE_COLUMN_MIGRATIONS = [
  ["prenom", "ALTER TABLE users ADD COLUMN prenom TEXT"],
  ["adresse", "ALTER TABLE users ADD COLUMN adresse TEXT"],
  ["telephone1", "ALTER TABLE users ADD COLUMN telephone1 TEXT"],
  ["telephone2", "ALTER TABLE users ADD COLUMN telephone2 TEXT"],
  ["email", "ALTER TABLE users ADD COLUMN email TEXT"],
] as const;

function ensureUserProfileColumns(db: Database.Database): void {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>).map(
      (col) => col.name,
    ),
  );
  for (const [name, sql] of USER_PROFILE_COLUMN_MIGRATIONS) {
    if (!columns.has(name)) db.exec(sql);
  }
  // Validation de compte : les comptes déjà présents avant l'ajout de
  // l'auto-inscription sont considérés validés (DEFAULT 1).
  if (!columns.has("approved")) {
    db.exec("ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1");
  }
  db.exec(
    "UPDATE users SET email = login WHERE (email IS NULL OR trim(email) = '') AND instr(login, '@') > 1",
  );
}

/** Ouvre (et initialise si besoin) la base d'administration. */
export function openAdminDb(dataDir: string): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "admin.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(ADMIN_SCHEMA);
  ensureUserProfileColumns(db);
  return db;
}

// ============ Requêtes utilisateurs ============

export function findUserByLogin(db: Database.Database, login: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE login = ?").get(login) as UserRow | undefined;
}

export function findUserByEmail(db: Database.Database, email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email) as
    | UserRow
    | undefined;
}

export function ensureUserEmailForLogin(db: Database.Database, login: string, email: string): void {
  db.prepare(
    "UPDATE users SET email = ? WHERE lower(login) = lower(?) AND (email IS NULL OR trim(email) = '')",
  ).run(email, login);
}

export function findUserById(db: Database.Database, id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

/** Liste des utilisateurs sans le hash de mot de passe. */
export function listUsers(db: Database.Database): Omit<UserRow, "password_hash">[] {
  return db
    .prepare(
      `SELECT id, login, nom, prenom, adresse, telephone1, telephone2, email,
              role, actif, approved, created_at, last_login_at
       FROM users
       ORDER BY login`,
    )
    .all() as Omit<UserRow, "password_hash">[];
}

export function createUser(
  db: Database.Database,
  data: {
    login: string;
    nom: string;
    prenom?: string | null;
    adresse?: string | null;
    telephone1?: string | null;
    telephone2?: string | null;
    email?: string | null;
    passwordHash: string;
    role: Role;
    /** Compte validé d'emblée (défaut). Faux pour une auto-inscription. */
    approved?: boolean;
  },
): number {
  const result = db
    .prepare(
      `INSERT INTO users (
        login, nom, prenom, adresse, telephone1, telephone2, email, password_hash, role, approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.login,
      data.nom,
      data.prenom ?? null,
      data.adresse ?? null,
      data.telephone1 ?? null,
      data.telephone2 ?? null,
      data.email ?? null,
      data.passwordHash,
      data.role,
      data.approved === false ? 0 : 1,
    );
  return Number(result.lastInsertRowid);
}

export function updateUserPassword(
  db: Database.Database,
  userId: number,
  passwordHash: string,
): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

export function updateUserProfile(
  db: Database.Database,
  userId: number,
  data: {
    nom: string;
    prenom?: string | null;
    adresse?: string | null;
    telephone1?: string | null;
    telephone2?: string | null;
    email?: string | null;
  },
): void {
  db.prepare(
    `UPDATE users
     SET nom = ?, prenom = ?, adresse = ?, telephone1 = ?, telephone2 = ?, email = ?
     WHERE id = ?`,
  ).run(
    data.nom,
    data.prenom ?? null,
    data.adresse ?? null,
    data.telephone1 ?? null,
    data.telephone2 ?? null,
    data.email ?? null,
    userId,
  );
}

export function setUserActive(db: Database.Database, userId: number, actif: boolean): void {
  db.prepare("UPDATE users SET actif = ? WHERE id = ?").run(actif ? 1 : 0, userId);
}

/** Valide (ou dévalide) un compte : accès complet aux fonctions restreintes. */
export function setUserApproved(db: Database.Database, userId: number, approved: boolean): void {
  db.prepare("UPDATE users SET approved = ? WHERE id = ?").run(approved ? 1 : 0, userId);
}

/** Nombre d'administrateurs actifs (garde-fou : ne jamais tomber à zéro). */
export function countActiveAdmins(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND actif = 1")
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
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
