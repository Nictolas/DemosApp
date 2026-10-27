-- REVIEW ONLY — separate approval required; Demos-Staging only.
-- A forward rollback migration must not be applied without checking fixture drift.
DO $gdpr_rollback$
DECLARE number_of_tables integer;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'GDPR_STAGING_ROLLBACK_CONTEXT_REJECTED';
  END IF;
  SELECT COUNT(*) INTO number_of_tables
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND c.relforcerowsecurity AND pg_catalog.pg_get_userbyid(c.relowner)='postgres'
      AND c.relname=ANY(ARRAY['users','user_consents','opinioni_risposte','political_selections','user_representatives','privacy_erasure_ledger']);
  IF number_of_tables <> 6 OR NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='demos_staging_runtime') THEN
    RAISE EXCEPTION 'GDPR_STAGING_ROLLBACK_DRIFT';
  END IF;
  IF (SELECT COUNT(*) FROM public.users) <> 2
    OR EXISTS(SELECT 1 FROM public.users WHERE id NOT IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid))
    OR EXISTS(SELECT 1 FROM public.privacy_erasure_ledger) THEN
    RAISE EXCEPTION 'GDPR_STAGING_ROLLBACK_UNEXPECTED_DATA';
  END IF;
  DROP TABLE public.political_selections,public.user_representatives,
    public.opinioni_risposte,public.user_consents,
    public.privacy_erasure_ledger,public.users;
  REVOKE USAGE ON SCHEMA public FROM demos_staging_runtime;
  DROP ROLE demos_staging_runtime;
END
$gdpr_rollback$;