-- OPS-STG-001: Demos-Staging P3 ballot ACL ONLY for synthetic CI/staging fixture users.
-- PREPARED, NOT APPLIED to shared staging. Requires separate operator-approved transaction:
-- BEGIN;
-- SET LOCAL civic.p3_runtime_approval='I_APPROVE_P3_SYNTHETIC_BALLOT_ACL';
-- [execute contents of this file]
-- COMMIT;
-- Does not import users, ballots, votes, tokens or change delivery settings.
-- This one shared staging role MAY see both synthetic fixture users' votes;
-- do NOT mistake this for production-quality per-user authorization.
DO $p3_acl_guard$
BEGIN
  IF current_setting('civic.p3_runtime_approval', true)
      IS DISTINCT FROM 'I_APPROVE_P3_SYNTHETIC_BALLOT_ACL' THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_APPROVAL_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM public.civic_runtime_identity
        WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_WRONG_DATABASE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname='demos_staging_runtime' AND rolcanlogin
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit
  ) THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_UNSAFE_RUNTIME_ROLE';
  END IF;
  IF (SELECT count(*) FROM public.users) <> 2 OR EXISTS (
    SELECT 1 FROM public.users WHERE id NOT IN (
      '00000000-0000-4000-8000-000000000301'::uuid,
      '00000000-0000-4000-8000-000000000302'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_NON_SYNTHETIC_USERS';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard
      WHERE id=1 AND blocked IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_DELIVERY_UNBLOCKED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.civic_ballots)
     OR EXISTS (SELECT 1 FROM public.civic_ballot_positions) THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_NONEMPTY_TABLES';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid IN ('public.civic_ballots'::regclass,
                  'public.civic_ballot_positions'::regclass)
      AND NOT relrowsecurity
  ) THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_RLS_DISABLED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('civic_ballots','civic_ballot_positions')) THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_POLICIES_ALREADY_EXIST';
  END IF;
  IF has_table_privilege('demos_staging_runtime',
       'public.civic_ballots','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('demos_staging_runtime',
       'public.civic_ballot_positions','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_PREEXISTING_RUNTIME_GRANT';
  END IF;
  IF has_table_privilege('anon','public.civic_ballots','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','public.civic_ballots','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('anon','public.civic_ballot_positions','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','public.civic_ballot_positions','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'P3_BALLOT_ACL_PUBLIC_GRANT';
  END IF;
END
$p3_acl_guard$;

GRANT USAGE ON SCHEMA public TO demos_staging_runtime;
GRANT SELECT ON public.civic_ballots TO demos_staging_runtime;
GRANT SELECT, INSERT ON public.civic_ballot_positions TO demos_staging_runtime;

-- Only the single synthetic process and deliberately prefixed fixture ballots
-- are readable. Not even other staging rows are exposed.
CREATE POLICY p3_staging_synthetic_ballot_read ON public.civic_ballots
  FOR SELECT TO demos_staging_runtime USING (
    civic_process_id='00000000-0000-4000-8000-00000000b001'::uuid
    AND source_id LIKE 'staging-fixture-%'
  );
-- This application database role is shared, therefore RLS bounds rows to
-- synthetic identities only. Per-user auth must still be enforced by the app.
CREATE POLICY p3_staging_synthetic_position_read ON public.civic_ballot_positions
  FOR SELECT TO demos_staging_runtime USING (
    user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,
                '00000000-0000-4000-8000-000000000302'::uuid)
    AND EXISTS (
      SELECT 1 FROM public.civic_ballots b WHERE b.id=civic_ballot_id
    )
  );
CREATE POLICY p3_staging_synthetic_position_insert ON public.civic_ballot_positions
  FOR INSERT TO demos_staging_runtime WITH CHECK (
    user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,
                '00000000-0000-4000-8000-000000000302'::uuid)
    AND EXISTS (
      SELECT 1 FROM public.civic_ballots b WHERE b.id=civic_ballot_id
    )
  );
