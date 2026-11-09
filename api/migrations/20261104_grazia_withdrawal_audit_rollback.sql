-- DEMOS 12: rollback only if no historical withdrawal evidence exists.
-- Do not run against a live system without DPO approval and a backup.
BEGIN;
DO $grazia_rollback_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.richieste_grazia
    WHERE withdrawn_at IS NOT NULL OR withdrawn_by IS NOT NULL
       OR withdraw_note IS NOT NULL OR withdraw_notification_sent IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Grazia withdrawal audit exists: manual retention-approved migration required';
  END IF;
END
$grazia_rollback_guard$;
ALTER TABLE public.richieste_grazia
  DROP CONSTRAINT IF EXISTS richieste_grazia_withdraw_note_length,
  DROP COLUMN IF EXISTS withdrawn_at,
  DROP COLUMN IF EXISTS withdrawn_by,
  DROP COLUMN IF EXISTS withdraw_note,
  DROP COLUMN IF EXISTS withdraw_notification_sent;
COMMIT;
