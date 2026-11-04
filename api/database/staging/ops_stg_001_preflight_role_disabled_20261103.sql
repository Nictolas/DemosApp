-- OPS-STG-001: DISABLED preflight role bootstrap, deliberately NO password.
-- PREPARED ONLY: do not apply on the live shared staging before separate
-- operator authorization, credential handling and rollback plan are approved.
-- A future operator must execute the COMPLETE file in one transaction:
-- BEGIN;
-- SET LOCAL civic.preflight_role_approval='I_APPROVE_DISABLED_PREFLIGHT_ROLE';
-- [this file, no extra statements];
-- COMMIT;
-- This does not generate, store, expose or activate any database secret.
DO $preflight_role_guard$
BEGIN
  IF current_setting('civic.preflight_role_approval', true)
       IS DISTINCT FROM 'I_APPROVE_DISABLED_PREFLIGHT_ROLE' THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_OPERATOR_APPROVAL_REQUIRED';
  END IF;
  IF current_database() <> 'postgres'
     OR (SELECT count(*) FROM public.civic_runtime_identity
         WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_WRONG_DATABASE';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard
      WHERE id=1 AND blocked IS TRUE) <> 1
     OR (SELECT count(*) FROM public.civic_push_delivery_guard) <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_PUSH_MUST_REMAIN_BLOCKED';
  END IF;
  -- Two accepted fixture footprints, never a broad name-based exemption:
  -- (1) the original two pending P0 fixtures used by disposable CI, or
  -- (2) those two plus the exact two 03/11 QA preference fixtures in shared
  -- staging. The latter use fingerprints of random UUIDs to avoid publishing
  -- raw user identifiers. Any fifth user or altered QA state fails closed.
  IF (SELECT count(*) FROM public.users) = 2 THEN
    IF EXISTS (SELECT 1 FROM public.users
        WHERE id NOT IN (
          '00000000-0000-4000-8000-000000000301'::uuid,
          '00000000-0000-4000-8000-000000000302'::uuid
        )
        OR status IS DISTINCT FROM 'pending') THEN
      RAISE EXCEPTION 'PREFLIGHT_ROLE_NON_SYNTHETIC_USERS';
    END IF;
  ELSIF (SELECT count(*) FROM public.users) = 4 THEN
    IF (SELECT count(*) FROM public.users
        WHERE id IN (
          '00000000-0000-4000-8000-000000000301'::uuid,
          '00000000-0000-4000-8000-000000000302'::uuid
        ) AND status = 'pending') <> 2
       OR (SELECT count(*) FROM public.users u
           WHERE md5(u.id::text) IN (
             '837b804435eef9fafbc580ce17a24fd4',
             'c1f6c8a73f029da2ee54a60dfd6a89d3'
           )
             AND u.id NOT IN (
               '00000000-0000-4000-8000-000000000301'::uuid,
               '00000000-0000-4000-8000-000000000302'::uuid
             )
             AND u.status = 'a' AND u.ruolo = 'E'
             AND u.account_type = 'PERSON'
             AND u.nome ~* '(test|synthetic|fittiz|demo|qa|fixture|prova)'
             AND u.political_opinions_consent IS FALSE
             AND u.political_opinions_consent_timestamp IS NULL
             AND u.political_opinions_consent_ip_address IS NULL
             AND u.political_opinions_consent_user_agent IS NULL
             AND u.rappresentante_camera IS NULL
             AND u.candidato_comune IS NULL
             AND u.candidato_attivo IS FALSE
             AND u.energia_nucleare IS NULL
             AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id=u.id)
             AND NOT EXISTS (SELECT 1 FROM public.user_devices d WHERE d.user_id=u.id)
             AND NOT EXISTS (SELECT 1 FROM public.user_consents c WHERE c.user_id=u.id)
             AND NOT EXISTS (SELECT 1 FROM public.opinioni_risposte o WHERE o.user_id=u.id)
           ) <> 2
       OR (SELECT count(*) FROM public.notifiche_preferenze p
           JOIN public.users u ON u.id=p.user_id
           WHERE md5(u.id::text) IN (
             '837b804435eef9fafbc580ce17a24fd4',
             'c1f6c8a73f029da2ee54a60dfd6a89d3'
           )) <> 2
       OR (SELECT count(*) FROM public.notifiche_preferenze p
           JOIN public.users u ON u.id=p.user_id
           WHERE md5(u.id::text) IN (
             '837b804435eef9fafbc580ce17a24fd4',
             'c1f6c8a73f029da2ee54a60dfd6a89d3'
           ) AND p.eci IS TRUE AND p.iniziative_popolari IS TRUE
             AND p.referendum_abrogativi IS TRUE) <> 1
       OR (SELECT count(*) FROM public.notifiche_preferenze p
           JOIN public.users u ON u.id=p.user_id
           WHERE md5(u.id::text) IN (
             '837b804435eef9fafbc580ce17a24fd4',
             'c1f6c8a73f029da2ee54a60dfd6a89d3'
           ) AND p.eci IS FALSE AND p.iniziative_popolari IS FALSE
             AND p.referendum_abrogativi IS FALSE) <> 1 THEN
      RAISE EXCEPTION 'PREFLIGHT_ROLE_NON_SYNTHETIC_USERS';
    END IF;
  ELSE
    RAISE EXCEPTION 'PREFLIGHT_ROLE_NON_SYNTHETIC_USERS';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
             WHERE rolname='demos_staging_preflight') THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_ALREADY_EXISTS';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies
             WHERE schemaname='public' AND policyname IN
               ('stg_preflight_identity_id1','stg_preflight_guard_id1')) THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_POLICY_COLLISION';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('civic_runtime_identity'),('civic_push_delivery_guard')) v(name)
    LEFT JOIN pg_catalog.pg_class c
      ON c.oid = to_regclass(format('public.%I',v.name))
    WHERE c.oid IS NULL OR c.relkind NOT IN ('r','p')
       OR NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_RLS_MISSING';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND
      c.relname IN ('civic_runtime_identity','civic_push_delivery_guard')
      AND (
        has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
        OR has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
      )
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_PUBLIC_CLIENT_ACCESS';
  END IF;
END
$preflight_role_guard$;

-- No password: not remotely usable until a separately approved secret is
-- created using an authorized secret-management path, NEVER this SQL file.
CREATE ROLE demos_staging_preflight
  LOGIN PASSWORD NULL NOINHERIT NOSUPERUSER NOBYPASSRLS
  NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 1;

-- Defense in depth; actual table/column grants below are the access boundary.
ALTER ROLE demos_staging_preflight SET default_transaction_read_only = 'on';
ALTER ROLE demos_staging_preflight SET statement_timeout = '5000ms';

GRANT USAGE ON SCHEMA public TO demos_staging_preflight;
-- Column-specific SELECT means it cannot read guard reason_code or other rows.
GRANT SELECT (id, db_identity) ON public.civic_runtime_identity
  TO demos_staging_preflight;
GRANT SELECT (id, blocked) ON public.civic_push_delivery_guard
  TO demos_staging_preflight;

-- Existing runtime policies are intentionally retained and not modified.
CREATE POLICY stg_preflight_identity_id1 ON public.civic_runtime_identity
  FOR SELECT TO demos_staging_preflight USING (id=1);
CREATE POLICY stg_preflight_guard_id1 ON public.civic_push_delivery_guard
  FOR SELECT TO demos_staging_preflight USING (id=1);

DO $preflight_role_postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.rolname='demos_staging_preflight'
      AND r.rolcanlogin AND NOT r.rolinherit AND NOT r.rolsuper
      AND NOT r.rolbypassrls AND NOT r.rolcreatedb
      AND NOT r.rolcreaterole AND NOT r.rolreplication
      AND r.rolconnlimit=1
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
                      WHERE m.member=r.oid)
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_UNSAFE_ATTRIBUTES';
  END IF;
  IF NOT (
    has_column_privilege('demos_staging_preflight',
      'public.civic_runtime_identity','id','SELECT')
    AND has_column_privilege('demos_staging_preflight',
      'public.civic_runtime_identity','db_identity','SELECT')
    AND has_column_privilege('demos_staging_preflight',
      'public.civic_push_delivery_guard','id','SELECT')
    AND has_column_privilege('demos_staging_preflight',
      'public.civic_push_delivery_guard','blocked','SELECT')
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_MISSING_ALLOWED_COLUMNS';
  END IF;
  IF has_table_privilege('demos_staging_preflight',
        'public.civic_runtime_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('demos_staging_preflight',
        'public.civic_push_delivery_guard','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_any_column_privilege('demos_staging_preflight',
        'public.civic_runtime_identity','INSERT,UPDATE,REFERENCES')
     OR has_any_column_privilege('demos_staging_preflight',
        'public.civic_push_delivery_guard','INSERT,UPDATE,REFERENCES')
     OR has_schema_privilege('demos_staging_preflight','public','CREATE')
     OR has_database_privilege('demos_staging_preflight',current_database(),'CREATE')
  THEN
    RAISE EXCEPTION 'PREFLIGHT_ROLE_UNEXPECTED_WRITE_PERMISSION';
  END IF;
END
$preflight_role_postcheck$;
