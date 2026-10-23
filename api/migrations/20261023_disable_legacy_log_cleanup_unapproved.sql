-- Production hardening 2026-10-23. No deletion of any data.
-- RP-09, RP-10 and RP-17 are NOT approved retention policies.
-- Legacy public functions reference tables no longer present in the production schema.
-- Do not reinstate cleanup without documented owner/DPO review and tested lifecycle handling.
BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'RETENTION_POLICY_NOT_APPROVED'
    USING ERRCODE = 'P0001';
END;
$function$;

COMMENT ON FUNCTION public.cleanup_old_logs() IS
  'Disabled pending an approved retention policy (RP-09/RP-10); raises without deleting data.';

-- Remove the implicit public Data API/RPC execute grant and any direct API-role grants.
REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs()
  FROM PUBLIC, anon, authenticated, service_role;
-- Adjacent legacy functions also mutate nonexistent historical log tables;
-- protect them from untrusted Data API calls without changing their body.
REVOKE EXECUTE ON FUNCTION public.compress_log_metadata()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_logging_stats()
  FROM PUBLIC, anon, authenticated, service_role;

-- The logging_jobs table is a legacy scheduler registry, not pg_cron itself.
-- Disable only the unapproved cleanup descriptor to prevent future schedulers
-- accidentally picking it up. Do not delete its audit/configuration history.
UPDATE public.logging_jobs
SET enabled = false, next_run = NULL
WHERE job_name = 'cleanup_old_logs';

COMMIT;
