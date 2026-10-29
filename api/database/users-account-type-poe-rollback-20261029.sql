-- DEMOS F12-12I: controlled rollback of account_type P/O/E to descriptive labels.
-- Only after deploying long+short-compatible code. Keeps users.ruolo default E.
-- Run in authorized release window with rollback log and fresh DB backup.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE account_type NOT IN ('P','O','E')) THEN
    RAISE EXCEPTION 'Unexpected account_type value: refusing rollback';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.users'::regclass
      AND tgname='users_capabilities_refresh_legacy_role'
      AND tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'Role projection trigger absent or disabled';
  END IF;
END $guard$;

CREATE TEMP TABLE user_role_rollback_snapshot ON COMMIT DROP AS
SELECT id, ruolo FROM public.users;

-- The historical trigger would otherwise recompute political roles from
-- incomplete legacy mandates, silently removing P/CP from public users.
ALTER TABLE public.users DISABLE TRIGGER users_capabilities_refresh_legacy_role;
ALTER TABLE public.users DROP CONSTRAINT users_account_type_check;

UPDATE public.users SET account_type = CASE account_type
  WHEN 'P' THEN 'PERSON'
  WHEN 'O' THEN 'ORGANIZATION'
  WHEN 'E' THEN 'INSTITUTION'
  ELSE account_type END
WHERE account_type IN ('P','O','E');

ALTER TABLE public.users
  ADD CONSTRAINT users_account_type_check
  CHECK (account_type IN ('PERSON','ORGANIZATION','INSTITUTION'));
ALTER TABLE public.users ALTER COLUMN account_type SET DEFAULT 'PERSON';

-- Restore the EXACT current production long-label role projection semantics.
-- Existing production function includes ACTIVE LEGACY_BACKFILL mandates when
-- deriving the historical P/CP labels. Losing that clause changes roles
-- on the NEXT unrelated account update, even if rollback snapshot matches.

CREATE OR REPLACE FUNCTION public.refresh_users_legacy_role(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_account_type VARCHAR(20);
  v_is_admin BOOLEAN;
  v_is_activist BOOLEAN;
  v_is_candidate BOOLEAN;
  v_is_politician BOOLEAN;
  v_legacy_role VARCHAR(3);
BEGIN
  SELECT account_type, is_admin, is_activist
  INTO v_account_type, v_is_admin, v_is_activist
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM political_candidacies pc
    WHERE pc.user_id = p_user_id
      AND pc.status = 'ACTIVE'
      AND pc.starts_at <= NOW()
      AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
  ) INTO v_is_candidate;

  SELECT EXISTS (
    SELECT 1 FROM political_mandates pm
    WHERE pm.user_id = p_user_id
      AND pm.status = 'ACTIVE'
      AND pm.starts_at <= NOW()
      AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
  ) INTO v_is_politician;

  v_legacy_role := CASE
    WHEN v_account_type = 'INSTITUTION' THEN 'I'
    WHEN v_account_type = 'ORGANIZATION' THEN 'O'
    WHEN v_is_admin THEN 'AD'
    WHEN v_is_politician AND v_is_candidate THEN 'CP'
    WHEN v_is_politician THEN 'P'
    WHEN v_is_candidate THEN 'C'
    WHEN v_is_activist THEN 'A'
    ELSE 'E'
  END;

  UPDATE public.users
  SET ruolo = v_legacy_role
  WHERE id = p_user_id
    AND ruolo IS DISTINCT FROM v_legacy_role;
END;
$$;

ALTER TABLE public.users ENABLE TRIGGER users_capabilities_refresh_legacy_role;

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users u
    FULL JOIN user_role_rollback_snapshot s ON s.id=u.id
    WHERE u.id IS NULL OR s.id IS NULL OR u.ruolo IS DISTINCT FROM s.ruolo
  ) THEN RAISE EXCEPTION 'Legacy roles changed during rollback'; END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE account_type NOT IN ('PERSON','ORGANIZATION','INSTITUTION')) THEN
    RAISE EXCEPTION 'Rollback did not restore descriptive account types'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.users'::regclass
      AND tgname='users_capabilities_refresh_legacy_role'
      AND tgenabled <> 'O'
  ) THEN RAISE EXCEPTION 'Role projection trigger not enabled after rollback'; END IF;
END $verify$;

COMMIT;
