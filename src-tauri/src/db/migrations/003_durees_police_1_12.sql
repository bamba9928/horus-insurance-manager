-- ============================================================
-- Migration 003 : Durées police mensuelles de 1 à 12 mois
-- ============================================================

PRAGMA foreign_keys = OFF;

DROP VIEW IF EXISTS v_echeances_30j;
DROP VIEW IF EXISTS v_impayes;
DROP TRIGGER IF EXISTS trg_polices_updated;
DROP TABLE IF EXISTS polices_new;

CREATE TABLE polices_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicule_id     INTEGER NOT NULL REFERENCES vehicules(id) ON DELETE CASCADE,
  assureur_id     INTEGER REFERENCES assureurs(id),
  numero_police   TEXT UNIQUE,
  type_carte      TEXT NOT NULL CHECK(type_carte IN ('VERTE','JAUNE')),
  date_effet      TEXT NOT NULL,
  duree_mois      INTEGER NOT NULL CHECK(duree_mois IN (1,2,3,4,5,6,7,8,9,10,11,12,24)),

  date_echeance   TEXT GENERATED ALWAYS AS (
                    date(date_effet, '+' || duree_mois || ' months', '-1 day')
                  ) STORED,

  appreciation    TEXT,
  statut          TEXT DEFAULT 'ACTIVE'
                    CHECK(statut IN ('ACTIVE','EXPIRÉE','ANNULÉE','RENOUVELÉE')),
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  external_reference TEXT,
  integration_status TEXT DEFAULT 'LOCAL'
                    CHECK(integration_status IN ('LOCAL','PENDING','SYNCED','ERROR')),
  last_sync_at    TEXT,
  sync_error      TEXT
);

INSERT INTO polices_new (
  id, vehicule_id, assureur_id, numero_police, type_carte, date_effet, duree_mois,
  appreciation, statut, created_at, updated_at, external_reference, integration_status,
  last_sync_at, sync_error
)
SELECT
  id, vehicule_id, assureur_id, numero_police, type_carte, date_effet, duree_mois,
  appreciation, statut, created_at, updated_at, external_reference, integration_status,
  last_sync_at, sync_error
FROM polices;

DROP TABLE polices;
ALTER TABLE polices_new RENAME TO polices;

CREATE INDEX IF NOT EXISTS idx_pol_echeance ON polices(date_echeance);
CREATE INDEX IF NOT EXISTS idx_pol_statut   ON polices(statut);
CREATE INDEX IF NOT EXISTS idx_pol_veh      ON polices(vehicule_id);
CREATE INDEX IF NOT EXISTS idx_pol_external_ref ON polices(external_reference);
CREATE INDEX IF NOT EXISTS idx_pol_integration_status ON polices(integration_status);

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

CREATE TRIGGER IF NOT EXISTS trg_polices_updated AFTER UPDATE ON polices
  BEGIN UPDATE polices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO _migrations (name) VALUES ('003_durees_police_1_12');
