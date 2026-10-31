-- Demos-Staging ONLY (Supabase project fkeayjzvtuvzesljhjbc).
-- Operator-reviewed DDL. One DO statement = one atomic PostgreSQL transaction.
-- ZERO production data, ZERO password, ZERO B2/Render configuration.
DO $demos_gdpr_staging_outbox$
DECLARE
  fixture_tables integer;
  exposed integer;
  policy_count integer;
  ok_role boolean;
BEGIN
  -- Defense against accidentally running on production:
  -- the PREVIOUS synthetic-only bootstrap migration and BOTH known invented
  -- fixture identities must already exist; production must not have them.
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
    OR current_setting('server_version_num')::integer < 170000
    OR NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE version='20261027205040')
    OR (SELECT count(*) FROM public.users) <> 2
    OR (SELECT count(*) FROM public.users
        WHERE (id='00000000-0000-4000-8000-000000000301'::uuid AND nome='Synthetic GDPR A')
           OR (id='00000000-0000-4000-8000-000000000302'::uuid AND nome='Synthetic GDPR B')) <> 2
    OR EXISTS (SELECT 1 FROM public.privacy_erasure_ledger)
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_CONTEXT_OR_FIXTURES_REJECTED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='demos_staging_b2_worker')
    OR to_regclass('public.privacy_erasure_delivery_outbox') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
      WHERE c.oid='public.privacy_erasure_ledger'::regclass
        AND p.polname='gdpr_fixture_worker_ledger_read')
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_PREEXISTING_OBJECTS';
  END IF;

  SELECT COUNT(*)::integer INTO fixture_tables
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND c.relforcerowsecurity
      AND pg_catalog.pg_get_userbyid(c.relowner)='postgres'
      AND c.relname=ANY(ARRAY[
        'users','user_consents','opinioni_risposte',
        'political_selections','user_representatives','privacy_erasure_ledger']);
  IF fixture_tables <> 6 THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_UNEXPECTED_EXISTING_SCHEMA';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='demos_staging_runtime' AND rolcanlogin
      AND NOT rolsuper AND NOT rolbypassrls)
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_RUNTIME_ROLE_NOT_SAFE';
  END IF;

  CREATE ROLE demos_staging_b2_worker
    LOGIN PASSWORD NULL NOSUPERUSER NOCREATEDB NOCREATEROLE
    NOINHERIT NOREPLICATION NOBYPASSRLS;

  CREATE TABLE public.privacy_erasure_delivery_outbox (
    event_key text PRIMARY KEY
      REFERENCES public.privacy_erasure_ledger(event_key) ON DELETE RESTRICT,
    queued_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    b2_version_id text,
    b2_sha256 char(64),
    CONSTRAINT gdpr_staging_delivery_receipt_all_or_none CHECK (
      (delivered_at IS NULL AND b2_version_id IS NULL AND b2_sha256 IS NULL)
      OR (delivered_at IS NOT NULL AND b2_version_id IS NOT NULL
          AND b2_sha256 IS NOT NULL)
    )
  );

  -- No table is committed before these settings apply.
  ALTER TABLE public.privacy_erasure_delivery_outbox ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.privacy_erasure_delivery_outbox FORCE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.privacy_erasure_delivery_outbox
    FROM PUBLIC, anon, authenticated, service_role;

  CREATE INDEX idx_privacy_erasure_outbox_pending
    ON public.privacy_erasure_delivery_outbox (queued_at, event_key)
    WHERE delivered_at IS NULL;

  GRANT USAGE ON SCHEMA public TO demos_staging_b2_worker;
  GRANT SELECT ON TABLE public.privacy_erasure_ledger
    TO demos_staging_b2_worker;
  GRANT SELECT, INSERT ON TABLE public.privacy_erasure_delivery_outbox
    TO demos_staging_runtime;
  GRANT SELECT, UPDATE (delivered_at, b2_version_id, b2_sha256)
    ON TABLE public.privacy_erasure_delivery_outbox
    TO demos_staging_b2_worker;

  -- Writer INSERT succeeds only if an existing matching ledger row is present,
  -- because of the FK. The real ledger itself limits writer INSERT to fixture
  -- UUIDs. Keep the outbox's writer SELECT policy compatible with RETURNING
  -- from the atomic two-CTE statement; this is a SYNTHETIC staging ACL only,
  -- NOT permission design for production.
  CREATE POLICY gdpr_fixture_outbox_runtime_insert
    ON public.privacy_erasure_delivery_outbox
    FOR INSERT TO demos_staging_runtime
    WITH CHECK (true);
  CREATE POLICY gdpr_fixture_outbox_runtime_select
    ON public.privacy_erasure_delivery_outbox
    FOR SELECT TO demos_staging_runtime
    USING (true);

  -- Delivery worker sees/ACKs only records joined to the two fictional
  -- subjects. This is not a bypass of the ledger's row security.
  CREATE POLICY gdpr_fixture_worker_ledger_read
    ON public.privacy_erasure_ledger
    FOR SELECT TO demos_staging_b2_worker
    USING (subject_user_id IN ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302'));
  CREATE POLICY gdpr_fixture_outbox_worker_select
    ON public.privacy_erasure_delivery_outbox
    FOR SELECT TO demos_staging_b2_worker
    USING (
      EXISTS (
        SELECT 1 FROM public.privacy_erasure_ledger l
        WHERE l.event_key=privacy_erasure_delivery_outbox.event_key
          AND l.subject_user_id IN ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302')
      )
    );
  CREATE POLICY gdpr_fixture_outbox_worker_update
    ON public.privacy_erasure_delivery_outbox
    FOR UPDATE TO demos_staging_b2_worker
    USING (
      EXISTS (
        SELECT 1 FROM public.privacy_erasure_ledger l
        WHERE l.event_key=privacy_erasure_delivery_outbox.event_key
          AND l.subject_user_id IN ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.privacy_erasure_ledger l
        WHERE l.event_key=privacy_erasure_delivery_outbox.event_key
          AND l.subject_user_id IN ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302')
      )
    );

  -- Fail before the single statement commits if ACL/RLS/catalogs differ
  -- from reviewed structure.
  SELECT COUNT(*)::integer INTO policy_count
    FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
    WHERE c.oid IN ('public.privacy_erasure_delivery_outbox'::regclass,
                    'public.privacy_erasure_ledger'::regclass)
      AND p.polname IN (
        'gdpr_fixture_outbox_runtime_insert',
        'gdpr_fixture_outbox_runtime_select',
        'gdpr_fixture_worker_ledger_read',
        'gdpr_fixture_outbox_worker_select',
        'gdpr_fixture_outbox_worker_update'
      );
  SELECT COUNT(*)::integer INTO exposed
    FROM pg_catalog.pg_class c
    WHERE c.oid='public.privacy_erasure_delivery_outbox'::regclass
      AND (
        NOT c.relrowsecurity OR NOT c.relforcerowsecurity
        OR pg_catalog.pg_get_userbyid(c.relowner) <> 'postgres'
        OR EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(
            COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
          WHERE a.grantee=0
        )
        OR EXISTS(
          SELECT 1 FROM pg_catalog.pg_attribute att
          CROSS JOIN LATERAL pg_catalog.aclexplode(att.attacl) a
          WHERE att.attrelid=c.oid AND att.attnum>0 AND NOT att.attisdropped
            AND a.grantee=0
        )
        OR EXISTS(
          SELECT 1 FROM pg_catalog.pg_roles r
          WHERE r.rolname IN ('anon','authenticated','service_role')
            AND (
              pg_catalog.has_any_column_privilege(r.rolname,c.oid,'SELECT')
              OR pg_catalog.has_any_column_privilege(r.rolname,c.oid,'INSERT')
              OR pg_catalog.has_any_column_privilege(r.rolname,c.oid,'UPDATE')
              OR pg_catalog.has_table_privilege(r.rolname,c.oid,'DELETE')
            )
        )
      );
  SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
      AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit)
    INTO ok_role FROM pg_catalog.pg_roles r
    WHERE r.rolname='demos_staging_b2_worker';
  IF policy_count <> 5 OR exposed <> 0 OR ok_role IS DISTINCT FROM true
    OR pg_catalog.has_table_privilege('demos_staging_b2_worker',
       'public.privacy_erasure_delivery_outbox','INSERT')
    OR pg_catalog.has_table_privilege('demos_staging_b2_worker',
       'public.privacy_erasure_ledger','INSERT')
    OR pg_catalog.has_table_privilege('demos_staging_runtime',
       'public.privacy_erasure_delivery_outbox','UPDATE')
    OR (SELECT COUNT(*) FROM public.privacy_erasure_delivery_outbox) <> 0
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_STAGING_SECURITY_POSTCHECK_FAILED';
  END IF;
END
$demos_gdpr_staging_outbox$;