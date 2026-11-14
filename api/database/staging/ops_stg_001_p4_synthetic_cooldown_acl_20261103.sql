-- OPS-STG-001 P4: PREPARED ONLY; NOT APPLIED to shared Supabase staging.
-- For two synthetic users and one synthetic referendum. Never production.
-- Requires P3 synthetic ballot ACL and explicit separate operator GO.
-- Run atomically only after approval:
--   BEGIN;
--   SET LOCAL civic.p4_runtime_approval='I_APPROVE_P4_SYNTHETIC_COOLDOWN_ACL';
--   [execute this file exactly once]
--   COMMIT;
-- A shared application DB role can read BOTH fixture users' cooldown timestamps;
-- it does NOT implement per-user authorization for real users.
DO $p4_acl_guard$
BEGIN
  IF current_setting('civic.p4_runtime_approval',true)
       IS DISTINCT FROM 'I_APPROVE_P4_SYNTHETIC_COOLDOWN_ACL' THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_APPROVAL_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM public.civic_runtime_identity
      WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_WRONG_DATABASE';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard
      WHERE id=1 AND blocked IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_DELIVERY_UNBLOCKED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles
      WHERE rolname='demos_staging_runtime' AND rolcanlogin
        AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit) THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_UNSAFE_ROLE';
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
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_NON_SYNTHETIC_USERS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='civic_ballots'
        AND policyname='p3_staging_synthetic_ballot_read')
     OR NOT EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='civic_ballot_positions'
        AND policyname='p3_staging_synthetic_position_insert') THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_P3_NOT_APPROVED';
  END IF;
  IF (SELECT count(*) FROM public.preference_change_cooldowns) <> 0 THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_NOT_EMPTY';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
      WHERE oid='public.preference_change_cooldowns'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='preference_change_cooldowns') THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_ALREADY_CONFIGURED';
  END IF;
  IF has_table_privilege('demos_staging_runtime',
      'public.preference_change_cooldowns','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('anon','public.preference_change_cooldowns','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','public.preference_change_cooldowns','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'P4_COOLDOWN_ACL_UNEXPECTED_GRANT';
  END IF;
END
$p4_acl_guard$;

GRANT USAGE ON SCHEMA public TO demos_staging_runtime;
GRANT SELECT, INSERT ON public.preference_change_cooldowns TO demos_staging_runtime;
-- The actual service only modifies last_changed_at on conflict.
GRANT UPDATE (last_changed_at) ON public.preference_change_cooldowns TO demos_staging_runtime;

-- Scope must match a visible synthetic ballot, not just a string prefix.
-- The existing P3 SELECT policy further limits the ballot lookup.
CREATE POLICY p4_staging_synthetic_cooldown_read
ON public.preference_change_cooldowns FOR SELECT TO demos_staging_runtime
USING (
  user_id IN ('00000000-0000-4000-8000-000000000301',
              '00000000-0000-4000-8000-000000000302')
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE scope = 'referendum-vote:' || b.id::text
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
);
CREATE POLICY p4_staging_synthetic_cooldown_insert
ON public.preference_change_cooldowns FOR INSERT TO demos_staging_runtime
WITH CHECK (
  user_id IN ('00000000-0000-4000-8000-000000000301',
              '00000000-0000-4000-8000-000000000302')
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE scope = 'referendum-vote:' || b.id::text
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
);
CREATE POLICY p4_staging_synthetic_cooldown_update
ON public.preference_change_cooldowns FOR UPDATE TO demos_staging_runtime
USING (
  user_id IN ('00000000-0000-4000-8000-000000000301',
              '00000000-0000-4000-8000-000000000302')
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE scope = 'referendum-vote:' || b.id::text
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
)
WITH CHECK (
  user_id IN ('00000000-0000-4000-8000-000000000301',
              '00000000-0000-4000-8000-000000000302')
  AND EXISTS (
    SELECT 1 FROM public.civic_ballots b
    WHERE scope = 'referendum-vote:' || b.id::text
      AND b.civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
      AND b.source_id LIKE 'staging-fixture-%'
  )
);
