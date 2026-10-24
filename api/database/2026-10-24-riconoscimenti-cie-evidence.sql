-- Apply to the existing PostgreSQL/Supabase database BEFORE deploying
-- the updated API. Existing open requests remain pending; they cannot be
-- approved until CIE verification and official evidence have been supplied.
BEGIN;
ALTER TABLE public.riconoscimenti
  ADD COLUMN IF NOT EXISTS fonte_elezione_url TEXT,
  ADD COLUMN IF NOT EXISTS fonte_candidatura_url TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
UPDATE public.riconoscimenti SET status = 'pending' WHERE status IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.riconoscimenti'::regclass
      AND conname = 'riconoscimenti_status_check'
  ) THEN
    ALTER TABLE public.riconoscimenti
      ADD CONSTRAINT riconoscimenti_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_riconoscimenti_pending
  ON public.riconoscimenti(created_at DESC) WHERE status = 'pending';
COMMIT;
