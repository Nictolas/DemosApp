-- Demos-Staging ONLY. Plan retained but NOT EXECUTED.
-- Reject changed/occupied fixtures or schema; six existing core tables are preserved.
DO $gdpr_outbox_rollback$
DECLARE
  secure_table_count integer;
  matching_policy_count integer;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres'
     OR NOT EXISTS (
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version='20261027205040')
     OR to_regclass('public.privacy_erasure_delivery_outbox') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname='demos_staging_b2_worker')
     OR (SELECT count(*) FROM public.users) <> 2
     OR (SELECT count(*) FROM public.users
         WHERE (id='00000000-0000-4000-8000-000000000301'::uuid AND nome='Synthetic GDPR A')
            OR (id='00000000-0000-4000-8000-000000000302'::uuid AND nome='Synthetic GDPR B')) <> 2
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_ROLLBACK_CONTEXT_REJECTED';
  END IF;
  SELECT COUNT(*)::integer INTO secure_table_count
    FROM pg_catalog.pg_class c
    WHERE c.oid='public.privacy_erasure_delivery_outbox'::regclass
      AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
      AND pg_catalog.pg_get_userbyid(c.relowner)='postgres';
  SELECT COUNT(*)::integer INTO matching_policy_count
    FROM pg_catalog.pg_policy p
    WHERE (p.polrelid='public.privacy_erasure_ledger'::regclass
      AND p.polname='gdpr_fixture_worker_ledger_read')
      OR (p.polrelid='public.privacy_erasure_delivery_outbox'::regclass
      AND p.polname IN ('gdpr_fixture_outbox_runtime_insert',
       'gdpr_fixture_outbox_runtime_select',
       'gdpr_fixture_outbox_worker_select',
       'gdpr_fixture_outbox_worker_update'));
  IF secure_table_count <> 1 OR matching_policy_count <> 5
     OR (SELECT COUNT(*) FROM public.privacy_erasure_delivery_outbox) <> 0
     OR (SELECT COUNT(*) FROM public.privacy_erasure_ledger) <> 0
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_stat_activity
       WHERE usename='demos_staging_b2_worker' AND datname=current_database()
     )
  THEN
    RAISE EXCEPTION 'GDPR_OUTBOX_ROLLBACK_DRIFT_OR_DATA_PRESENT';
  END IF;

  DROP POLICY gdpr_fixture_worker_ledger_read
    ON public.privacy_erasure_ledger;
  REVOKE ALL ON TABLE public.privacy_erasure_ledger
    FROM demos_staging_b2_worker;
  DROP TABLE public.privacy_erasure_delivery_outbox;
  REVOKE USAGE ON SCHEMA public FROM demos_staging_b2_worker;
  DROP ROLE demos_staging_b2_worker;
END
$gdpr_outbox_rollback$;