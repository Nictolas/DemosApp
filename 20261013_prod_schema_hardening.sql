BEGIN;

-- Fix search_path on functions introduced by the production capability/territory migrations.
ALTER FUNCTION public.refresh_users_legacy_role(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_refresh_users_legacy_role_from_relation() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_refresh_users_legacy_role_from_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_user_legacy_political_territories() SET search_path = public, pg_temp;

-- Cover foreign keys introduced by the new production schema.
CREATE INDEX IF NOT EXISTS idx_eventi_lifecycle_closed_by_user
  ON public.eventi(election_lifecycle_closed_by_user_id)
  WHERE election_lifecycle_closed_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_civic_processes_realized_verified_by
  ON public.civic_processes(realized_verified_by_user_id)
  WHERE realized_verified_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_civic_reconciliation_candidate_process
  ON public.civic_process_reconciliation_candidates(candidate_process_id);
CREATE INDEX IF NOT EXISTS idx_civic_reconciliation_reviewed_by
  ON public.civic_process_reconciliation_candidates(reviewed_by_user_id)
  WHERE reviewed_by_user_id IS NOT NULL;

COMMIT;
