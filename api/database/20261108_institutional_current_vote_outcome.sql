-- PROD-041 staged compatibility migration.
-- The earlier current-vote table was installed before verified outcome support.
-- DRAFT ONLY: production changes require separate explicit release approval.
BEGIN;
ALTER TABLE public.institutional_current_nominal_votes
  ADD COLUMN IF NOT EXISTS ballot_outcome text;
DO $prod041_outcome$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.institutional_current_nominal_votes'::regclass
      AND conname='institutional_current_nominal_votes_outcome_length_check'
  ) THEN
    ALTER TABLE public.institutional_current_nominal_votes
      ADD CONSTRAINT institutional_current_nominal_votes_outcome_length_check
      CHECK (ballot_outcome IS NULL OR length(ballot_outcome) BETWEEN 1 AND 100);
  END IF;
END $prod041_outcome$;
COMMIT;
