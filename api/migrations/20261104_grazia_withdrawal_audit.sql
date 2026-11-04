-- DEMOS 12: dedicated Grazia catalogue withdrawal audit; no second queue.
-- Apply ONLY transactionally after explicit authorization and privacy gate.
-- The canonical queue remains public.richieste_grazia and all historical votes stay intact.
BEGIN;
ALTER TABLE public.richieste_grazia
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdraw_note text,
  ADD COLUMN IF NOT EXISTS withdraw_notification_sent boolean;
DO $grazia_withdrawal_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.richieste_grazia'::regclass
      AND conname='richieste_grazia_withdraw_note_length'
  ) THEN
    ALTER TABLE public.richieste_grazia
      ADD CONSTRAINT richieste_grazia_withdraw_note_length
        CHECK (withdraw_note IS NULL OR char_length(withdraw_note) BETWEEN 3 AND 500);
  END IF;
END
$grazia_withdrawal_guard$;
COMMIT;
