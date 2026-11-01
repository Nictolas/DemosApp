-- DEMOS: staged account_type compact storage P(person)/O(organization)/E(institution).
-- DO NOT run before application compatibility PR is merged, tested in PostgreSQL 17
-- and staged, and a production rollback plan is approved.
-- The legacy users.ruolo is deliberately preserved and is a DIFFERENT namespace:
-- account_type='P' == PERSON, while ruolo='P' == Politico;
-- account_type='E' == INSTITUTION, while ruolo='E' == Elettore.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE account_type NOT IN ('PERSON','ORGANIZATION','INSTITUTION','P','O','E')
  ) THEN RAISE EXCEPTION 'Unexpected account_type in users; aborting compact migration'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'users_capabilities_refresh_legacy_role'
      AND NOT tgisinternal
      AND tgenabled = 'O'
  ) THEN RAISE EXCEPTION 'Expected legacy role projection trigger missing'; END IF;
END $guard$;

CREATE TEMP TABLE user_role_migration_snapshot ON COMMIT DROP AS
  SELECT id, ruolo FROM public.users;

-- Updating account_type otherwise invokes refresh_users_legacy_role for EVERY user,
-- which could silently downgrade legacy politicians with unverified mandates.
-- Disable ONLY that one trigger during this bounded, transactional migration.
ALTER TABLE public.users DISABLE TRIGGER users_capabilities_refresh_legacy_role;
ALTER TABLE public.users DROP CONSTRAINT users_account_type_check;

UPDATE public.users SET account_type = CASE account_type
  WHEN 'PERSON' THEN 'P'
  WHEN 'ORGANIZATION' THEN 'O'
  WHEN 'INSTITUTION' THEN 'E'
  ELSE account_type END
WHERE account_type IN ('PERSON','ORGANIZATION','INSTITUTION');

ALTER TABLE public.users
  ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('P','O','E'));
ALTER TABLE public.users ALTER COLUMN account_type SET DEFAULT 'P';

-- Preserve the existing function search_path (public, pg_temp) as well as
-- its invoker security; do not weaken its security config on replace.
-- Preserve the existing legacy projection behavior for non-type capabilities
-- while accepting the new account_type codes.
CREATE OR REPLACE FUNCTION public.refresh_users_legacy_role(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $role$
DECLARE
  v_account_type VARCHAR(20);
  v_is_admin BOOLEAN;
  v_is_activist BOOLEAN;
  v_is_candidate BOOLEAN;
  v_is_politician BOOLEAN;
  v_legacy_role VARCHAR(3);
  v_existing_legacy_role VARCHAR(50);
BEGIN
  SELECT account_type, is_admin, is_activist, ruolo
  INTO v_account_type, v_is_admin, v_is_activist, v_existing_legacy_role
  FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.political_candidacies pc
    WHERE pc.user_id = p_user_id
      AND pc.status = 'ACTIVE'
      AND pc.starts_at <= NOW()
      AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
  ) INTO v_is_candidate;

  SELECT EXISTS (
    SELECT 1 FROM public.political_mandates pm
    WHERE pm.user_id = p_user_id
      AND pm.status = 'ACTIVE'
      AND pm.source <> 'LEGACY_BACKFILL'
      AND pm.starts_at <= NOW()
      AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
  ) INTO v_is_politician;

  v_legacy_role := CASE
    WHEN v_account_type IN ('E','INSTITUTION') THEN 'I'
    WHEN v_account_type IN ('O','ORGANIZATION') THEN 'O'
    WHEN v_is_admin THEN 'AD'
    -- Provenance is not complete: never silently convert P/CP legacy profiles
    -- to E/C/A solely because a capability flag changes.
    WHEN v_existing_legacy_role = 'CP' AND NOT (v_is_politician AND v_is_candidate) THEN 'CP'
    WHEN v_existing_legacy_role = 'P' AND NOT v_is_politician THEN 'P'
    WHEN v_is_politician AND v_is_candidate THEN 'CP'
    WHEN v_is_politician THEN 'P'
    WHEN v_is_candidate THEN 'C'
    WHEN v_is_activist THEN 'A'
    ELSE 'E'
  END;

  UPDATE public.users SET ruolo = v_legacy_role
  WHERE id = p_user_id AND ruolo IS DISTINCT FROM v_legacy_role;
END;
$role$;

ALTER TABLE public.users ENABLE TRIGGER users_capabilities_refresh_legacy_role;

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE account_type NOT IN ('P','O','E')) THEN
    RAISE EXCEPTION 'Old account type still present';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users u
    FULL JOIN user_role_migration_snapshot s ON s.id = u.id
    WHERE u.id IS NULL OR s.id IS NULL OR u.ruolo IS DISTINCT FROM s.ruolo
  ) THEN
    RAISE EXCEPTION 'Role projection changed during account_type migration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgrelid='public.users'::regclass
               AND tgname='users_capabilities_refresh_legacy_role' AND NOT tgenabled='O') THEN
    RAISE EXCEPTION 'Role projection trigger was not re-enabled';
  END IF;
END $verify$;

COMMIT;
