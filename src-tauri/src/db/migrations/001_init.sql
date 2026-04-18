-- ============================================================
-- Migration 001 : Schéma initial AssurAuto Manager
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============ CLIENTS ============
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

-- ============ VÉHICULES ============
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

-- ============ ASSUREURS ============
CREATE TABLE IF NOT EXISTS assureurs (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nom     TEXT NOT NULL UNIQUE,
  contact TEXT,
  adresse TEXT
);

-- ============ POLICES (cœur métier) ============
CREATE TABLE IF NOT EXISTS polices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicule_id     INTEGER NOT NULL REFERENCES vehicules(id) ON DELETE CASCADE,
  assureur_id     INTEGER REFERENCES assureurs(id),
  numero_police   TEXT UNIQUE,
  type_carte      TEXT NOT NULL CHECK(type_carte IN ('VERTE','JAUNE')),
  date_effet      TEXT NOT NULL,
  duree_mois      INTEGER NOT NULL CHECK(duree_mois IN (1,3,6,9,12,24)),

  -- Échéance calculée : Effet + N mois - 1 jour
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

-- ============ PAIEMENTS ============
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

-- ============ AUDIT LOG ============
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT NOT NULL,
  entity_id   INTEGER NOT NULL,
  action      TEXT NOT NULL CHECK(action IN ('CREATE','UPDATE','DELETE')),
  diff        TEXT,
  user        TEXT DEFAULT 'system',
  timestamp   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============ VUES ============

-- Échéances dans les 30 prochains jours (+ 7 jours en retard)
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

-- Paiements impayés
CREATE VIEW IF NOT EXISTS v_impayes AS
  SELECT pa.id, c.nom_prenom, v.immatriculation, p.numero_police,
         pa.montant_du, pa.paye, pa.reste, p.date_echeance
  FROM paiements pa
  JOIN polices  p ON p.id = pa.police_id
  JOIN vehicules v ON v.id = p.vehicule_id
  JOIN clients  c ON c.id = v.client_id
  WHERE pa.reste > 0;

-- ============ TRIGGERS updated_at ============
CREATE TRIGGER IF NOT EXISTS trg_clients_updated AFTER UPDATE ON clients
  BEGIN UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_polices_updated AFTER UPDATE ON polices
  BEGIN UPDATE polices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ============ TABLE DE MIGRATIONS ============
CREATE TABLE IF NOT EXISTS _migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  applied   TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO _migrations (name) VALUES ('001_init');
