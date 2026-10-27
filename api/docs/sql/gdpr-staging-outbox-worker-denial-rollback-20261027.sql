-- DEMOS-STAGING ONLY, synthetic negative privilege/RLS proof.
-- The deliberately out-of-scope event is never committed; transaction ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
DO $deny_guard$
BEGIN
 IF current_user <> 'postgres' OR current_database()<>'postgres'
 OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
   WHERE name='gdpr_staging_b2_outbox_worker_secure_20261027')
 OR (SELECT COUNT(*) FROM public.privacy_erasure_ledger)<>0
 OR (SELECT COUNT(*) FROM public.privacy_erasure_delivery_outbox)<>0
 THEN RAISE EXCEPTION 'GDPR_OUTBOX_NEGATIVE_PROOF_CONTEXT_REJECTED';
 END IF;
END
$deny_guard$;

-- The privileged temporary fixture mimics a row from outside the two
-- subjects in the dedicated synthetic RLS policies.
INSERT INTO public.privacy_erasure_ledger
 (event_key,subject_user_id,event_type,details)
 VALUES ('00000000-0000-4000-8000-0000000003b9','00000000-0000-4000-8000-000000000399',
 'political_consent_revoked','{"synthetic":"forbidden-other-subject"}'::jsonb);
INSERT INTO public.privacy_erasure_delivery_outbox(event_key)
 VALUES ('00000000-0000-4000-8000-0000000003b9');

GRANT demos_staging_b2_worker TO postgres
 WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
SET LOCAL ROLE demos_staging_b2_worker;
DO $worker_denial_proof$
DECLARE n integer; denied boolean;
BEGIN
 IF current_user <> 'demos_staging_b2_worker'
 THEN RAISE EXCEPTION 'GDPR_OUTBOX_NEGATIVE_PROOF_WRONG_ROLE'; END IF;

 SELECT COUNT(*)::integer INTO n
 FROM public.privacy_erasure_ledger
 WHERE subject_user_id='00000000-0000-4000-8000-000000000399';
 IF n <> 0 THEN RAISE EXCEPTION 'GDPR_WORKER_RLS_LEDGER_LEAK'; END IF;

 SELECT COUNT(*)::integer INTO n
 FROM public.privacy_erasure_delivery_outbox
 WHERE event_key='00000000-0000-4000-8000-0000000003b9';
 IF n <> 0 THEN RAISE EXCEPTION 'GDPR_WORKER_RLS_OUTBOX_LEAK'; END IF;

 UPDATE public.privacy_erasure_delivery_outbox
 SET delivered_at=NOW(), b2_version_id='unapproved',
 b2_sha256=repeat('a',64)
 WHERE event_key='00000000-0000-4000-8000-0000000003b9';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'GDPR_WORKER_ACK_OUTSIDE_FIXTURE_ALLOWED'; END IF;

 denied := false;
 BEGIN
  INSERT INTO public.privacy_erasure_ledger
   (event_key,subject_user_id,event_type,details)
   VALUES ('00000000-0000-4000-8000-0000000003b8',
    '00000000-0000-4000-8000-000000000399','political_consent_revoked','{}'::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'GDPR_WORKER_LEDGER_INSERT_ALLOWED'; END IF;

 denied := false;
 BEGIN
  INSERT INTO public.privacy_erasure_delivery_outbox(event_key)
  VALUES ('00000000-0000-4000-8000-0000000003b9');
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'GDPR_WORKER_OUTBOX_INSERT_ALLOWED'; END IF;
END
$worker_denial_proof$;
RESET ROLE;
SELECT current_user AS proof_role,
 'GDPR_OUTBOX_WORKER_NEGATIVE_RLS_PASS_PENDING_ROLLBACK'::text AS result;
ROLLBACK;
