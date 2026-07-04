/**
 * Bases métier par utilisateur (« tenant ») : un fichier SQLite par compte,
 * créé depuis le même schéma que l'application desktop (migrations 001/002)
 * + la migration 003 qui lève la contrainte obsolète sur vehicules.genre.
 *
 * L'isolation des données est structurelle : un utilisateur connecté
 * n'ouvre que son propre fichier — aucune requête ne peut fuiter ailleurs.
 *
 * @module db/tenants
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Migrations métier, identiques à src-tauri/src/db/migrations/ pour que
 * l'import d'une base desktop existante fonctionne tel quel (le suivi se
 * fait via la table _migrations, comme sur le desktop).
 */
export const TENANT_MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "001_init",
    sql: `
CREATE TABLE IF NOT EXISTS clients (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_prenom    TEXT NOT NULL,
  adresse       TEXT,
  telephone     TEXT,
  email         TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom_prenom);
CREATE INDEX IF NOT EXISTS idx_clients_tel ON clients(telephone);

CREATE TABLE IF NOT EXISTS vehicules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  immatriculation TEXT NOT NULL UNIQUE,
  marque          TEXT,
  modele          TEXT,
  genre           TEXT CHECK(genre IN ('VP','VP/CI','TPV','TPC','TPM','MOTO')),
  type_vehicule   TEXT,
  puissance       INTEGER,
  places          INTEGER,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_veh_imm    ON vehicules(immatriculation);
CREATE INDEX IF NOT EXISTS idx_veh_client ON vehicules(client_id);

CREATE TABLE IF NOT EXISTS assureurs (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nom     TEXT NOT NULL UNIQUE,
  contact TEXT,
  adresse TEXT
);

CREATE TABLE IF NOT EXISTS polices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicule_id     INTEGER NOT NULL REFERENCES vehicules(id) ON DELETE CASCADE,
  assureur_id     INTEGER REFERENCES assureurs(id),
  numero_police   TEXT UNIQUE,
  type_carte      TEXT NOT NULL CHECK(type_carte IN ('VERTE','JAUNE')),
  date_effet      TEXT NOT NULL,
  duree_mois      INTEGER NOT NULL CHECK(duree_mois IN (1,3,6,9,12,24)),

  date_echeance   TEXT GENERATED ALWAYS AS (
                    date(date_effet, '+' || duree_mois || ' months', '-1 day')
                  ) STORED,

  appreciation    TEXT,
  statut          TEXT DEFAULT 'ACTIVE'
                    CHECK(statut IN ('ACTIVE','EXPIRÉE','ANNULÉE','RENOUVELÉE')),
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pol_echeance ON polices(date_echeance);
CREATE INDEX IF NOT EXISTS idx_pol_statut   ON polices(statut);
CREATE INDEX IF NOT EXISTS idx_pol_veh      ON polices(vehicule_id);

CREATE TABLE IF NOT EXISTS paiements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  police_id     INTEGER NOT NULL REFERENCES polices(id) ON DELETE CASCADE,
  montant_du    INTEGER NOT NULL,
  paye          INTEGER DEFAULT 0,
  avance        INTEGER DEFAULT 0,
  reste         INTEGER GENERATED ALWAYS AS (montant_du - paye - avance) STORED,
  date_paiement TEXT,
  mode          TEXT CHECK(mode IN ('ESPECES','VIREMENT','MOBILE_MONEY','CHEQUE')),
  reference     TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT NOT NULL,
  entity_id   INTEGER NOT NULL,
  action      TEXT NOT NULL CHECK(action IN ('CREATE','UPDATE','DELETE')),
  diff        TEXT,
  user        TEXT DEFAULT 'system',
  timestamp   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE VIEW IF NOT EXISTS v_echeances_30j AS
  SELECT p.id, c.nom_prenom, c.telephone, v.immatriculation, v.marque,
         p.date_effet, p.date_echeance, p.type_carte, p.numero_police,
         CAST(julianday(p.date_echeance) - julianday('now') AS INTEGER) AS jours_restants
  FROM polices p
  JOIN vehicules v ON v.id = p.vehicule_id
  JOIN clients   c ON c.id = v.client_id
  WHERE p.statut = 'ACTIVE'
    AND date(p.date_echeance) BETWEEN date('now','-7 days') AND date('now','+30 days')
  ORDER BY p.date_echeance;

CREATE VIEW IF NOT EXISTS v_impayes AS
  SELECT pa.id, c.nom_prenom, v.immatriculation, p.numero_police,
         pa.montant_du, pa.paye, pa.reste, p.date_echeance
  FROM paiements pa
  JOIN polices  p ON p.id = pa.police_id
  JOIN vehicules v ON v.id = p.vehicule_id
  JOIN clients  c ON c.id = v.client_id
  WHERE pa.reste > 0;

CREATE TRIGGER IF NOT EXISTS trg_clients_updated AFTER UPDATE ON clients
  BEGIN UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_polices_updated AFTER UPDATE ON polices
  BEGIN UPDATE polices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

INSERT OR IGNORE INTO _migrations (name) VALUES ('001_init');
`,
  },
  {
    name: "002_integrations",
    sql: `
ALTER TABLE assureurs ADD COLUMN code TEXT;
ALTER TABLE assureurs ADD COLUMN integration_type TEXT DEFAULT 'MANUAL'
  CHECK(integration_type IN ('MANUAL','MOCK','API'));
ALTER TABLE assureurs ADD COLUMN api_base_url TEXT;
ALTER TABLE assureurs ADD COLUMN portal_url TEXT;
ALTER TABLE assureurs ADD COLUMN technical_contact TEXT;
ALTER TABLE assureurs ADD COLUMN integration_enabled INTEGER DEFAULT 0
  CHECK(integration_enabled IN (0,1));
ALTER TABLE assureurs ADD COLUMN last_connection_status TEXT;
ALTER TABLE assureurs ADD COLUMN last_connection_at TEXT;

ALTER TABLE polices ADD COLUMN external_reference TEXT;
ALTER TABLE polices ADD COLUMN integration_status TEXT DEFAULT 'LOCAL'
  CHECK(integration_status IN ('LOCAL','PENDING','SYNCED','ERROR'));
ALTER TABLE polices ADD COLUMN last_sync_at TEXT;
ALTER TABLE polices ADD COLUMN sync_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assureurs_code ON assureurs(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assureurs_integration ON assureurs(integration_type, integration_enabled);
CREATE INDEX IF NOT EXISTS idx_pol_external_ref ON polices(external_reference);
CREATE INDEX IF NOT EXISTS idx_pol_integration_status ON polices(integration_status);

CREATE TABLE IF NOT EXISTS integration_exchange_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  assureur_id     INTEGER REFERENCES assureurs(id) ON DELETE SET NULL,
  police_id       INTEGER REFERENCES polices(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK(direction IN ('IN','OUT')),
  status          TEXT NOT NULL CHECK(status IN ('SUCCESS','ERROR','PENDING')),
  request_payload TEXT,
  response_payload TEXT,
  external_reference TEXT,
  error_message   TEXT,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exchange_logs_assureur ON integration_exchange_logs(assureur_id);
CREATE INDEX IF NOT EXISTS idx_exchange_logs_police ON integration_exchange_logs(police_id);
CREATE INDEX IF NOT EXISTS idx_exchange_logs_created ON integration_exchange_logs(created_at);

INSERT OR IGNORE INTO _migrations (name) VALUES ('002_integrations');
`,
  },
  {
    // La contrainte CHECK de 001 sur `genre` ne connaît pas les catégories
    // actuelles (CAT_01…CAT_10, BUS_ECOLE, REMORQUE) : reconstruction de la
    // table sans CHECK — la validation se fait dans les schémas Zod.
    name: "003_genre_categories",
    sql: `
-- Les vues référencent vehicules : suppression avant reconstruction,
-- recréation après (sinon ALTER ... RENAME échoue à les revalider).
DROP VIEW IF EXISTS v_echeances_30j;
DROP VIEW IF EXISTS v_impayes;

-- Filet de sécurité si une exécution précédente s'était interrompue.
DROP TABLE IF EXISTS vehicules_new;

CREATE TABLE vehicules_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  immatriculation TEXT NOT NULL UNIQUE,
  marque          TEXT,
  modele          TEXT,
  genre           TEXT,
  type_vehicule   TEXT,
  puissance       INTEGER,
  places          INTEGER,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vehicules_new (id, client_id, immatriculation, marque, modele, genre, type_vehicule, puissance, places, created_at)
  SELECT id, client_id, immatriculation, marque, modele, genre, type_vehicule, puissance, places, created_at
  FROM vehicules;

DROP TABLE vehicules;
ALTER TABLE vehicules_new RENAME TO vehicules;

CREATE INDEX IF NOT EXISTS idx_veh_imm    ON vehicules(immatriculation);
CREATE INDEX IF NOT EXISTS idx_veh_client ON vehicules(client_id);

CREATE VIEW v_echeances_30j AS
  SELECT p.id, c.nom_prenom, c.telephone, v.immatriculation, v.marque,
         p.date_effet, p.date_echeance, p.type_carte, p.numero_police,
         CAST(julianday(p.date_echeance) - julianday('now') AS INTEGER) AS jours_restants
  FROM polices p
  JOIN vehicules v ON v.id = p.vehicule_id
  JOIN clients   c ON c.id = v.client_id
  WHERE p.statut = 'ACTIVE'
    AND date(p.date_echeance) BETWEEN date('now','-7 days') AND date('now','+30 days')
  ORDER BY p.date_echeance;

CREATE VIEW v_impayes AS
  SELECT pa.id, c.nom_prenom, v.immatriculation, p.numero_police,
         pa.montant_du, pa.paye, pa.reste, p.date_echeance
  FROM paiements pa
  JOIN polices  p ON p.id = pa.police_id
  JOIN vehicules v ON v.id = p.vehicule_id
  JOIN clients  c ON c.id = v.client_id
  WHERE pa.reste > 0;

INSERT OR IGNORE INTO _migrations (name) VALUES ('003_genre_categories');
`,
  },
];

/** Migrations qui reconstruisent une table : foreign_keys doit être OFF autour. */
const FK_OFF_MIGRATIONS = new Set(["003_genre_categories"]);

/** Applique les migrations manquantes sur une base métier. */
export function migrateTenantDb(db: Database.Database): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS _migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  applied   TEXT DEFAULT CURRENT_TIMESTAMP
);
`);
  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as Array<{ name: string }>).map(
      (r) => r.name,
    ),
  );
  for (const migration of TENANT_MIGRATIONS) {
    if (applied.has(migration.name)) continue;

    // Chaque migration est atomique : un crash en cours de route est
    // intégralement annulé (y compris l'insertion dans _migrations), donc
    // elle sera rejouée proprement au prochain démarrage. foreign_keys ne
    // peut pas être basculé dans une transaction : on le fait autour.
    const needsFkOff = FK_OFF_MIGRATIONS.has(migration.name);
    if (needsFkOff) db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => db.exec(migration.sql))();
    } finally {
      if (needsFkOff) db.pragma("foreign_keys = ON");
    }
  }
}

export function tenantsDir(dataDir: string): string {
  return path.join(dataDir, "tenants");
}

/** Chemin du fichier SQLite d'un utilisateur (l'ID vient de la DB : pas de traversée possible). */
export function tenantDbPath(dataDir: string, userId: number): string {
  return path.join(tenantsDir(dataDir), `user_${userId}.db`);
}

/** Cache des connexions ouvertes, clé = chemin du fichier. */
const openDbs = new Map<string, Database.Database>();

/**
 * Ouvre la base métier d'un utilisateur (création + migrations au besoin).
 * Les connexions sont mises en cache pour la durée de vie du process.
 */
export function openTenantDb(dataDir: string, userId: number): Database.Database {
  const dbPath = tenantDbPath(dataDir, userId);
  const cached = openDbs.get(dbPath);
  if (cached?.open) return cached;

  fs.mkdirSync(tenantsDir(dataDir), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  try {
    migrateTenantDb(db);
  } catch (err) {
    // Ne pas conserver un handle sur une base non migrée.
    db.close();
    throw err;
  }
  openDbs.set(dbPath, db);
  return db;
}

/** Crée la base d'un nouvel utilisateur (puis la referme aussitôt). */
export function provisionTenantDb(dataDir: string, userId: number): string {
  const dbPath = tenantDbPath(dataDir, userId);
  const db = openTenantDb(dataDir, userId);
  db.close();
  openDbs.delete(dbPath);
  return dbPath;
}

/** Ferme toutes les connexions tenant en cache (arrêt propre, tests). */
export function closeAllTenantDbs(): void {
  for (const db of openDbs.values()) {
    if (db.open) db.close();
  }
  openDbs.clear();
}

/** Ferme et retire du cache la base d'un utilisateur (avant remplacement du fichier). */
export function closeTenantDb(dataDir: string, userId: number): void {
  const dbPath = tenantDbPath(dataDir, userId);
  const db = openDbs.get(dbPath);
  if (db?.open) db.close();
  openDbs.delete(dbPath);
}
