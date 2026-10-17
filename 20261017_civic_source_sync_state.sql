-- Stato persistente dei connettori ufficiali dei processi civici.
-- Serve a evitare scansioni complete delle fonti a ogni riavvio del backend.

BEGIN;

CREATE TABLE IF NOT EXISTS civic_source_sync_state (
  source_id TEXT PRIMARY KEY,
  last_successful_sync_at TIMESTAMPTZ,
  cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE civic_source_sync_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE civic_source_sync_state IS
  'Checkpoint interni dei connettori ufficiali dei processi civici; accesso solo backend.';

COMMIT;
