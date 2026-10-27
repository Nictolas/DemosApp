-- DEMOS STAGING ONLY: fkeayjzvtuvzesljhjbc (never production).
-- A single transaction: temporarily permit SET ROLE, exercise RLS as the actual
-- synthetic least-privilege SQL role, and ROLLBACK both membership and all DML.
-- No password, no external connections, no personal data and no permanent ACL.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
-- PostgreSQL 17 CREATEROLE bootstrap auto-membership is SET FALSE.
-- This grant changes it only inside the transaction, reverted by ROLLBACK.
GRANT demos_staging_runtime TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
SET LOCAL ROLE demos_staging_runtime;

DO $gdpr_proof$
DECLARE n integer; rejected boolean;
BEGIN
  IF current_user <> 'demos_staging_runtime'
    OR current_database() <> 'postgres'
    OR (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user) IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'GDPR_STAGING_SQL_IDENTITY_INCORRECT';
  END IF;

  SELECT count(*)::integer INTO n FROM public.users;
  IF n <> 2 THEN RAISE EXCEPTION 'GDPR_STAGING_RLS_READ_UNEXPECTED'; END IF;
  SELECT count(*)::integer INTO n FROM public.privacy_erasure_ledger;
  IF n <> 0 THEN RAISE EXCEPTION 'GDPR_STAGING_LEDGER_NOT_EMPTY'; END IF;

  -- The writer may append a legitimate synthetic revocation to the ledger.
  INSERT INTO public.privacy_erasure_ledger
    (event_key, subject_user_id, event_type, details)
    VALUES ('synthetic-rollback-only-20261027', '00000000-0000-4000-8000-000000000301',
      'political_consent_revoked', '{"source":"synthetic_transaction_rollback"}'::jsonb);
  SELECT count(*)::integer INTO n
    FROM public.privacy_erasure_ledger
    WHERE event_key='synthetic-rollback-only-20261027';
  IF n <> 1 THEN RAISE EXCEPTION 'GDPR_STAGING_LEDGER_WRITE_NOT_VISIBLE'; END IF;

  -- The writer must NOT be able to forge a revocation for an unrelated ID.
  rejected := false;
  BEGIN
    INSERT INTO public.privacy_erasure_ledger
      (event_key, subject_user_id, event_type, details)
      VALUES ('synthetic-unauthorized-rollback-only', 'outside-synthetic-subject',
        'political_consent_revoked', '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'GDPR_STAGING_CROSS_SUBJECT_INSERT_ALLOWED'; END IF;

  -- The ledger must be append-only for the least-privilege SQL role.
  rejected := false;
  BEGIN
    UPDATE public.privacy_erasure_ledger
      SET details='{"tampered":true}'::jsonb
      WHERE event_key='synthetic-rollback-only-20261027';
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'GDPR_STAGING_LEDGER_UPDATE_ALLOWED'; END IF;

  -- Consent withdrawal and erasure are possible for an invented subject.
  UPDATE public.users SET political_opinions_consent=false
    WHERE id='00000000-0000-4000-8000-000000000301'::uuid;
  UPDATE public.user_consents SET political_opinions_consent=false
    WHERE user_id='00000000-0000-4000-8000-000000000301'::uuid;
  DELETE FROM public.political_selections
    WHERE user_id='00000000-0000-4000-8000-000000000301'::uuid;
  DELETE FROM public.opinioni_risposte
    WHERE user_id='00000000-0000-4000-8000-000000000301'::uuid;
  DELETE FROM public.user_representatives
    WHERE user_id='00000000-0000-4000-8000-000000000301'::uuid;

  SELECT count(*)::integer INTO n FROM public.political_selections;
  IF n <> 1 THEN RAISE EXCEPTION 'GDPR_STAGING_REVOCATION_DELETE_SCOPE_INCORRECT'; END IF;
  SELECT count(*)::integer INTO n FROM public.opinioni_risposte;
  IF n <> 0 THEN RAISE EXCEPTION 'GDPR_STAGING_REVOCATION_OPINION_PERSISTED'; END IF;

  -- A third person is not part of the allowlist. No write is permitted.
  rejected := false;
  BEGIN
    INSERT INTO public.users(id,nome,ruolo,political_opinions_consent)
      VALUES ('00000000-0000-4000-8000-000000000399'::uuid,
        'Disallowed synthetic third user','E',true);
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'GDPR_STAGING_OUT_OF_SCOPE_USER_CREATED'; END IF;
END
$gdpr_proof$;
SELECT current_user AS tested_role,
       (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user) AS tested_role_bypass_rls,
       (SELECT count(*)::integer FROM public.privacy_erasure_ledger) AS events_visible_before_rollback,
       'PROOF_VALID_IN_TRANSACTION_PENDING_ROLLBACK'::text AS status;
ROLLBACK;
-- Postcheck separately: pg_has_role(...,'SET')=false, ledger=0, fixture counts unchanged.
