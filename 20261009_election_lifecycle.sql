-- DEMOS — chiusura canonica del lifecycle delle elezioni.
-- Registra soltanto chi/quando ha chiuso il lifecycle applicativo dell'evento.

BEGIN;

ALTER TABLE eventi
  ADD COLUMN IF NOT EXISTS election_lifecycle_closed_at TIMESTAMPTZ;

ALTER TABLE eventi
  ADD COLUMN IF NOT EXISTS election_lifecycle_closed_by_user_id UUID;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eventi_election_lifecycle_closed_by_user_fk'
  ) THEN
    ALTER TABLE eventi
      ADD CONSTRAINT eventi_election_lifecycle_closed_by_user_fk
      FOREIGN KEY (election_lifecycle_closed_by_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_eventi_election_lifecycle_open
  ON eventi (COALESCE(giorno_fine, giorno_inizio))
  WHERE LOWER(TRIM(tipologia_evento)) = 'elezioni'
    AND election_lifecycle_closed_at IS NULL;

COMMIT;
