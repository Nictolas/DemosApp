BEGIN;

-- Existing rows predate the approval workflow and are treated as already approved.
ALTER TABLE eventi ADD COLUMN IF NOT EXISTS creator_user_id UUID;
ALTER TABLE eventi ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20);
ALTER TABLE eventi ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;
ALTER TABLE eventi ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE eventi ADD COLUMN IF NOT EXISTS approved_by_user_id UUID;
ALTER TABLE eventi ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE eventi
SET approval_status = 'APPROVED',
    approved_at = COALESCE(approved_at, created_at, CURRENT_TIMESTAMP)
WHERE approval_status IS NULL;

ALTER TABLE eventi ALTER COLUMN approval_status SET DEFAULT 'PENDING';
ALTER TABLE eventi ALTER COLUMN approval_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eventi_approval_status_check'
  ) THEN
    ALTER TABLE eventi
      ADD CONSTRAINT eventi_approval_status_check
      CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_eventi_approval_status_date
  ON eventi(approval_status, giorno_inizio);
CREATE INDEX IF NOT EXISTS idx_eventi_creator_user
  ON eventi(creator_user_id)
  WHERE creator_user_id IS NOT NULL;

COMMIT;
