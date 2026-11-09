-- DEMOS12 review-notification metadata rollback (DRAFT ONLY; NEVER run automatically).
-- Use only before the feature has written any notice status. If any status
-- exists, preserve the audit record and require a DPO-approved migration plan.
BEGIN;
DO $rollback_guard$
BEGIN
  IF to_regclass('public.subject_proposals') IS NULL THEN
    RAISE EXCEPTION 'subject_proposals does not exist; nothing to roll back';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.subject_proposals
    WHERE submission_notification_sent IS NOT NULL OR review_notification_sent IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot drop recorded notification states without authorized retention/DSAR review';
  END IF;
END
$rollback_guard$;
ALTER TABLE public.subject_proposals
  DROP COLUMN IF EXISTS submission_notification_sent,
  DROP COLUMN IF EXISTS review_notification_sent;
COMMIT;
