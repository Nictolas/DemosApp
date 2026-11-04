-- OPS-STG-001 P5: synthetic-only aggregate snapshot ACL, PREPARED NOT APPLIED.
-- Explicit operator-approved BEGIN/SET LOCAL/execute/COMMIT only after P3 ACL.
-- This is not a production user-authorization scheme.
-- Two fixture users cannot meet the production 10-response threshold;
-- SQL contract tests may insert synthetic aggregate values, which DO NOT
-- prove that the real capture service can generate a 10-response snapshot.
DO $p5_acl_guard$
BEGIN
  IF current_setting('civic.p5_runtime_approval',true)
    IS DISTINCT FROM 'I_APPROVE_P5_SYNTHETIC_SNAPSHOT_ACL' THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_APPROVAL_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM public.civic_runtime_identity
      WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_WRONG_DATABASE';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard
      WHERE id=1 AND blocked IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_DELIVERY_UNBLOCKED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles
      WHERE rolname='demos_staging_runtime' AND rolcanlogin
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit) THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_UNSAFE_RUNTIME_ROLE';
  END IF;
  -- Two original, pending GDPR fixtures are mandatory. The staging-only
  -- notification QA ON/OFF pair may coexist, but cannot vote through P3/P4/P5.
  -- Every additional account or different state fails closed.
  IF (SELECT count(*) FROM public.users) NOT IN (2,4)
     OR (SELECT count(*) FROM public.users
         WHERE id IN ('00000000-0000-4000-8000-000000000301'::uuid,
                      '00000000-0000-4000-8000-000000000302'::uuid)
           AND status='pending') <> 2
     OR EXISTS (
       SELECT 1 FROM public.users
       WHERE id NOT IN ('00000000-0000-4000-8000-000000000301'::uuid,
                        '00000000-0000-4000-8000-000000000302'::uuid)
         AND (nome IS NULL OR nome NOT IN
               ('DEMOS_CIVIC_QA_20261104_ON','DEMOS_CIVIC_QA_20261104_OFF')
              OR status IS DISTINCT FROM 'a'
              OR account_type IS DISTINCT FROM 'PERSON')
     )
     OR ((SELECT count(*) FROM public.users) = 4 AND (
       (SELECT count(*) FROM public.users
        WHERE nome='DEMOS_CIVIC_QA_20261104_ON' AND status='a'
          AND account_type='PERSON') <> 1
       OR (SELECT count(*) FROM public.users
        WHERE nome='DEMOS_CIVIC_QA_20261104_OFF' AND status='a'
          AND account_type='PERSON') <> 1
     )) THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_NON_SYNTHETIC_USERS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='civic_ballots'
      AND policyname='p3_staging_synthetic_ballot_read') THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_P3_NOT_APPROVED';
  END IF;
  IF (SELECT count(*) FROM public.civic_ballot_forecast_snapshots) <> 0
     OR NOT (SELECT relrowsecurity FROM pg_class
               WHERE oid='public.civic_ballot_forecast_snapshots'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname='public'
                 AND tablename='civic_ballot_forecast_snapshots') THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_ALREADY_USED_OR_CONFIGURED';
  END IF;
  IF has_table_privilege('demos_staging_runtime',
       'public.civic_ballot_forecast_snapshots','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('anon',
       'public.civic_ballot_forecast_snapshots','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated',
       'public.civic_ballot_forecast_snapshots','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'P5_SNAPSHOT_ACL_UNEXPECTED_GRANT';
  END IF;
END
$p5_acl_guard$;

GRANT USAGE ON SCHEMA public TO demos_staging_runtime;
GRANT SELECT, INSERT ON public.civic_ballot_forecast_snapshots
  TO demos_staging_runtime;
-- Only mutable aggregate counters and update timestamp; no changing
-- ballot identity, bucket, freeze status, or creation time.
GRANT UPDATE (total_responses,yes_count,no_count,abstain_count,updated_at)
  ON public.civic_ballot_forecast_snapshots TO demos_staging_runtime;

CREATE POLICY p5_staging_synthetic_snapshot_read
ON public.civic_ballot_forecast_snapshots FOR SELECT TO demos_staging_runtime
USING (
  total_responses >= 10
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE b.id = civic_ballot_id
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
);
CREATE POLICY p5_staging_synthetic_snapshot_insert
ON public.civic_ballot_forecast_snapshots FOR INSERT TO demos_staging_runtime
WITH CHECK (
  total_responses >= 10
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE b.id = civic_ballot_id
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
);
CREATE POLICY p5_staging_synthetic_snapshot_update
ON public.civic_ballot_forecast_snapshots FOR UPDATE TO demos_staging_runtime
USING (
  is_frozen IS FALSE
  AND total_responses >= 10
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE b.id = civic_ballot_id
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
)
WITH CHECK (
  is_frozen IS FALSE
  AND total_responses >= 10
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE b.id = civic_ballot_id
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
);
