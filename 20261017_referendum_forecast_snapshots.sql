-- DEMOS — storico aggregato della previsione referendum.
-- Nessun user_id: conserva solo conteggi aggregati in finestre temporali.

BEGIN;

CREATE TABLE IF NOT EXISTS civic_ballot_forecast_snapshots (
  civic_ballot_id UUID NOT NULL REFERENCES civic_ballots(id) ON DELETE CASCADE,
  bucket_start TIMESTAMPTZ NOT NULL,
  total_responses INTEGER NOT NULL,
  yes_count INTEGER NOT NULL,
  no_count INTEGER NOT NULL,
  abstain_count INTEGER NOT NULL,
  is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (civic_ballot_id, bucket_start),
  CHECK (total_responses >= 0),
  CHECK (yes_count >= 0),
  CHECK (no_count >= 0),
  CHECK (abstain_count >= 0),
  CHECK (yes_count + no_count + abstain_count = total_responses)
);

CREATE INDEX IF NOT EXISTS idx_civic_ballot_forecast_snapshots_ballot_time
  ON civic_ballot_forecast_snapshots(civic_ballot_id, bucket_start DESC);

ALTER TABLE civic_ballot_forecast_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE civic_ballot_forecast_snapshots IS
  'Snapshot aggregati della previsione DEMOS; nessun identificativo utente e nessun dato individuale storico.';

COMMIT;
