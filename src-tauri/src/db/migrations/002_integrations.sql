-- ============================================================
-- Migration 002 : Préparation des intégrations compagnies
-- ============================================================

PRAGMA foreign_keys = ON;

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
