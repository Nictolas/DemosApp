-- OPS-STG-001 / P0: grant only the minimum permissions to a *synthetic*
-- Demos-Staging application role. NOT approved for deployment to production.
-- Requires operator attestation and a single explicit transaction:
-- BEGIN;
-- SET LOCAL civic.p0_runtime_approval='I_APPROVE_P0_SYNTHETIC_RUNTIME_ACCESS';
-- [execute this file]
-- COMMIT;
-- No rows, real profiles, credentials, or tokens are created by this script.
DO $p0_runtime_guard$
DECLARE
  fixture_users CONSTANT uuid[] := ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ];
BEGIN
  IF current_setting('civic.p0_runtime_approval', TRUE)
       IS DISTINCT FROM 'I_APPROVE_P0_SYNTHETIC_RUNTIME_ACCESS' THEN
    RAISE EXCEPTION 'P0_RUNTIME_APPROVAL_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM public.civic_runtime_identity
      WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'P0_RUNTIME_WRONG_DATABASE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname='demos_staging_runtime' AND rolcanlogin
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit
  ) THEN
    RAISE EXCEPTION 'P0_RUNTIME_UNSAFE_LOGIN';
  END IF;
  IF (SELECT count(*) FROM public.users) <> 2 OR
     EXISTS (SELECT 1 FROM public.users
        WHERE NOT id=ANY(fixture_users) OR status IS DISTINCT FROM 'pending') THEN
    RAISE EXCEPTION 'P0_RUNTIME_NON_SYNTHETIC_USERS';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard WHERE id=1
      AND blocked=TRUE) <> 1 THEN
    RAISE EXCEPTION 'P0_RUNTIME_DELIVERY_GUARD_NOT_BLOCKED';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM (VALUES ('user_profile'),('notifiche_demos'),
                   ('iniziative_popolari'),('referendum_abrogativi')) t(name)
      LEFT JOIN pg_class c ON c.oid=to_regclass(format('public.%I', t.name))
      WHERE c.oid IS NULL OR c.relkind NOT IN ('r','p') OR NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'P0_RUNTIME_SCHEMA_OR_RLS_MISSING';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profile)
     OR EXISTS (SELECT 1 FROM public.notifiche_demos)
     OR EXISTS (SELECT 1 FROM public.iniziative_popolari)
     OR EXISTS (SELECT 1 FROM public.referendum_abrogativi) THEN
    RAISE EXCEPTION 'P0_RUNTIME_TABLES_NOT_EMPTY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('user_profile','notifiche_demos',
                        'iniziative_popolari','referendum_abrogativi')
  ) THEN
    RAISE EXCEPTION 'P0_RUNTIME_POLICIES_ALREADY_PRESENT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN ('user_profile','notifiche_demos',
                        'iniziative_popolari','referendum_abrogativi')
      AND (
        has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
      )
  ) THEN
    RAISE EXCEPTION 'P0_RUNTIME_PUBLIC_GRANT_EXPOSED';
  END IF;
END
$p0_runtime_guard$;

-- Restrict writes to two synthetic users; no deletion rights.
GRANT USAGE ON SCHEMA public TO demos_staging_runtime;
GRANT SELECT, INSERT, UPDATE ON public.user_profile, public.notifiche_demos
  TO demos_staging_runtime;
GRANT SELECT ON public.iniziative_popolari, public.referendum_abrogativi
  TO demos_staging_runtime;

CREATE POLICY p0_staging_profile_fixture ON public.user_profile
  FOR ALL TO demos_staging_runtime
  USING (user_id=ANY(ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ]))
  WITH CHECK (user_id=ANY(ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ]));

CREATE POLICY p0_staging_notifications_fixture ON public.notifiche_demos
  FOR ALL TO demos_staging_runtime
  USING (id_utente=ANY(ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ]))
  WITH CHECK (id_utente=ANY(ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ]));

-- List routes may read public initiatives/referenda, but cannot mutate them.
CREATE POLICY p0_staging_initiatives_read ON public.iniziative_popolari
  FOR SELECT TO demos_staging_runtime USING (TRUE);
CREATE POLICY p0_staging_referenda_read ON public.referendum_abrogativi
  FOR SELECT TO demos_staging_runtime USING (TRUE);
