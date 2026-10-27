-- DEMOS-STAGING ONLY (fkeayjzvtuvzesljhjbc), no provider I/O.
-- The following exercises BOTH SQL roles and always ends in ROLLBACK.
-- No password or lasting grant; no personal data or live B2 objects.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
DO $staging_gate$
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres'
    OR NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name='gdpr_staging_b2_outbox_worker_secure_20261027')
    OR (SELECT COUNT(*) FROM public.users) <> 2
    OR EXISTS(SELECT 1 FROM public.privacy_erasure_ledger)
    OR EXISTS(SELECT 1 FROM public.privacy_erasure_delivery_outbox)
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_ROLE_PROOF_CONTEXT_REJECTED';
  END IF;
END
$staging_gate$;

-- Role memberships exist from the PostgreSQL 17 CREATE ROLE bootstrap, but
-- SET is disabled. Grant SET privilege temporarily, within THIS transaction.
GRANT demos_staging_runtime TO postgres
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
GRANT demos_staging_b2_worker TO postgres
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

SET LOCAL ROLE demos_staging_runtime;
DO $writer_proof$
DECLARE
  n integer;
BEGIN
  IF current_user <> 'demos_staging_runtime'
    OR (SELECT rolbypassrls FROM pg_catalog.pg_roles
        WHERE rolname=current_user) IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_INCORRECT_WRITER_IDENTITY';
  END IF;

  -- Same CTE shape as Ledger.recordEvent (flag ON), no independent DDL.
  WITH event_insert AS (
    INSERT INTO public.privacy_erasure_ledger
      (event_key,subject_user_id,event_type,occurred_at,details)
    VALUES ('00000000-0000-4000-8000-0000000003a1','00000000-0000-4000-8000-000000000301',
      'political_consent_revoked',now(),
      '{"source":"fictional_outbox_transaction_proof"}'::jsonb)
    RETURNING event_key,subject_user_id,event_type,occurred_at,details
  ), delivery_insert AS (
    INSERT INTO public.privacy_erasure_delivery_outbox(event_key)
    SELECT event_key FROM event_insert RETURNING event_key
  )
  SELECT COUNT(*)::integer INTO n
    FROM event_insert e JOIN delivery_insert d USING(event_key);
  IF n <> 1 THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_LEDGER_AND_OUTBOX_NOT_ATOMIC';
  END IF;
  SELECT COUNT(*)::integer INTO n
    FROM public.privacy_erasure_delivery_outbox
    WHERE event_key='00000000-0000-4000-8000-0000000003a1' AND delivered_at IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_PENDING_EVENT_NOT_VISIBLE';
  END IF;
END
$writer_proof$;

RESET ROLE;
SET LOCAL ROLE demos_staging_b2_worker;
DO $worker_proof$
DECLARE
  n integer;
BEGIN
  IF current_user <> 'demos_staging_b2_worker'
    OR (SELECT rolbypassrls FROM pg_catalog.pg_roles
        WHERE rolname=current_user) IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_INCORRECT_WORKER_IDENTITY';
  END IF;
  -- Exact pending JOIN/ROW LOCK shape used by worker.runOnce.
  SELECT COUNT(*)::integer INTO n
  FROM (
    SELECT o.event_key
    FROM public.privacy_erasure_delivery_outbox o
    JOIN public.privacy_erasure_ledger l ON l.event_key=o.event_key
    WHERE o.delivered_at IS NULL
    ORDER BY o.queued_at ASC,o.event_key ASC LIMIT 1
    FOR UPDATE OF o SKIP LOCKED
  ) q;
  IF n <> 1 THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_WORKER_CANNOT_LOCK_PENDING';
  END IF;
  UPDATE public.privacy_erasure_delivery_outbox
  SET delivered_at=now(), b2_version_id='synthetic-offline-receipt',
    b2_sha256=repeat('a',64)
  WHERE event_key='00000000-0000-4000-8000-0000000003a1' AND delivered_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_RECEIPT_UPDATE_DENIED';
  END IF;
  SELECT COUNT(*)::integer INTO n
    FROM public.privacy_erasure_delivery_outbox
    WHERE event_key='00000000-0000-4000-8000-0000000003a1' AND delivered_at IS NOT NULL
      AND b2_version_id='synthetic-offline-receipt';
  IF n <> 1 THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_RECEIPT_NOT_VISIBLE';
  END IF;
END
$worker_proof$;

RESET ROLE;
SELECT current_user AS completed_as,
       (SELECT COUNT(*)::integer FROM public.privacy_erasure_ledger) AS transient_events,
       (SELECT COUNT(*)::integer FROM public.privacy_erasure_delivery_outbox
        WHERE delivered_at IS NOT NULL) AS transient_deliveries,
       'GDPR_OUTBOX_STAGING_WRITER_WORKER_PROOF_PENDING_ROLLBACK' AS status;
ROLLBACK;
-- Separate read-only postcheck MUST show empty tables and membership SET=false.
