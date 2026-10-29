-- PostgreSQL 17 disposable fixture ONLY. Never run against a shared/staging/prod DB.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL DEFAULT 'PERSON',
  ruolo VARCHAR(3) NOT NULL DEFAULT 'E',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_activist BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.political_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  election_event_id UUID,
  office_code TEXT,
  institution_code TEXT,
  jurisdiction JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  source VARCHAR(30) NOT NULL DEFAULT 'DEMOS',
  legacy_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('ACTIVE','ENDED','CANCELLED')),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- Minimal matching shape of tables read by the production role-projection trigger.
CREATE TABLE public.political_candidacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ
);

-- Synthetic reconstruction of the functions/triggers returned by the
-- PRODUCTION schema catalog on 2026-10-29; intentionally retains legacy issue
-- so integration tests reveal actual side effects, not an imagined fixed schema.
CREATE OR REPLACE FUNCTION public.refresh_users_legacy_role(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
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
  FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM political_candidacies pc
    WHERE pc.user_id = p_user_id AND pc.status='ACTIVE'
      AND pc.starts_at <= NOW() AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
  ) INTO v_is_candidate;

  -- EXACT production behavior: this includes LEGACY_BACKFILL (known defect).
  SELECT EXISTS (
    SELECT 1 FROM political_mandates pm
    WHERE pm.user_id = p_user_id AND pm.status='ACTIVE'
      AND pm.starts_at <= NOW() AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
  ) INTO v_is_politician;

  v_legacy_role := CASE
    WHEN v_account_type='INSTITUTION' THEN 'I'
    WHEN v_account_type='ORGANIZATION' THEN 'O'
    WHEN v_is_admin THEN 'AD'
    WHEN v_is_politician AND v_is_candidate THEN 'CP'
    WHEN v_is_politician THEN 'P'
    WHEN v_is_candidate THEN 'C'
    WHEN v_is_activist THEN 'A'
    ELSE 'E'
  END;
  UPDATE users SET ruolo=v_legacy_role WHERE id=p_user_id
    AND ruolo IS DISTINCT FROM v_legacy_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_refresh_users_legacy_role_from_relation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp'
AS $function$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM refresh_users_legacy_role(OLD.user_id); RETURN OLD;
  END IF;
  PERFORM refresh_users_legacy_role(NEW.user_id);
  IF TG_OP='UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM refresh_users_legacy_role(OLD.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER political_mandates_refresh_legacy_role
AFTER INSERT OR DELETE OR UPDATE ON public.political_mandates
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_users_legacy_role_from_relation();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','pg_temp'
AS $function$
BEGIN
  NEW.updated_at=NOW(); RETURN NEW;
END;
$function$;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.users (id, account_type, ruolo) VALUES
 ('11111111-1111-4111-8111-111111111111','PERSON','P'),
 ('22222222-2222-4222-8222-222222222222','PERSON','P'),
 ('33333333-3333-4333-8333-333333333333','ORGANIZATION','O');

-- One fake LEGACY_BACKFILL row whose alleged current role must not block
-- insertion of an independently verified historical mandate.
INSERT INTO public.political_mandates(user_id,office_code,source,status,starts_at)
VALUES ('11111111-1111-4111-8111-111111111111','S','LEGACY_BACKFILL','ACTIVE',
        '2026-10-13T00:00:00Z');
