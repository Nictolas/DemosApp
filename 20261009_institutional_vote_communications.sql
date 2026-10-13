-- DEMOS — institutional vote communications, additive migration.
-- Keeps legacy rows intact and adds only the metadata needed for deduplication
-- and the five 90-day Transparency Podiums.

BEGIN;

ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) DEFAULT 'comunicazione';
ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS institutional_level VARCHAR(20);
ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS vote_date DATE;
ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS source_vote_id TEXT;
ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS institutional_vote_key VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comunicazioni_institutional_level_check'
      AND conrelid = 'comunicazioni'::regclass
  ) THEN
    ALTER TABLE comunicazioni
      ADD CONSTRAINT comunicazioni_institutional_level_check
      CHECK (
        institutional_level IS NULL OR
        institutional_level IN ('EUROPEO', 'CAMERA', 'SENATO', 'REGIONE', 'COMUNE')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comunicazioni_politician_vote_key
  ON comunicazioni(id_utente, institutional_vote_key)
  WHERE institutional_vote_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comunicazioni_transparency_window
  ON comunicazioni(institutional_level, vote_date DESC, id_utente)
  WHERE tipo = 'votazione'
    AND institutional_vote_key IS NOT NULL
    AND vote_date IS NOT NULL;

COMMIT;
