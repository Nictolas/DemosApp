#!/usr/bin/env bash
# PostgreSQL 17 synthetic fixture only. Never point this at production.
set -euo pipefail
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruolo VARCHAR(50) DEFAULT 'Elettore',
  status VARCHAR(20) DEFAULT 'pending',
  account_type VARCHAR(20) NOT NULL DEFAULT 'PERSON',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_activist BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT users_account_type_check CHECK (account_type IN ('PERSON','ORGANIZATION','INSTITUTION'))
);
CREATE TABLE public.political_candidacies (
  user_id UUID, status VARCHAR(30), starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ
);
CREATE TABLE public.political_mandates (
  user_id UUID, status VARCHAR(30), source VARCHAR(70), starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ
);
CREATE OR REPLACE FUNCTION public.refresh_users_legacy_role(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path TO public, pg_temp AS $f$
BEGIN
  UPDATE public.users SET ruolo = CASE
    WHEN account_type = 'ORGANIZATION' THEN 'O'
    WHEN account_type = 'INSTITUTION' THEN 'I'
    WHEN is_admin THEN 'AD' ELSE 'E' END
  WHERE id = p_user_id;
END;
$f$;
CREATE OR REPLACE FUNCTION public.trg_refresh_users_legacy_role_from_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $t$
BEGIN
  PERFORM public.refresh_users_legacy_role(NEW.id);
  RETURN NEW;
END;
$t$;
CREATE TRIGGER users_capabilities_refresh_legacy_role
  AFTER UPDATE OF account_type, is_admin, is_activist ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_users_legacy_role_from_user();

INSERT INTO public.users (id, account_type, ruolo, status) VALUES
  ('00000000-0000-4000-8000-000000000001', 'PERSON', 'P', 'a'),
  ('00000000-0000-4000-8000-000000000002', 'PERSON', 'E', 'a'),
  ('00000000-0000-4000-8000-000000000003', 'ORGANIZATION', 'O', 'a'),
  ('00000000-0000-4000-8000-000000000004', 'INSTITUTION', 'I', 'a'),
  ('00000000-0000-4000-8000-000000000005', 'PERSON', 'CP', 'a');
INSERT INTO public.political_mandates(user_id,status,source,starts_at,ends_at) VALUES
('00000000-0000-4000-8000-000000000001','ACTIVE','LEGACY_BACKFILL',NOW() - INTERVAL '1 year',NULL),
('00000000-0000-4000-8000-000000000005','ACTIVE','LEGACY_BACKFILL',NOW() - INTERVAL '1 year',NULL);
INSERT INTO public.political_candidacies(user_id,status,starts_at,ends_at) VALUES
('00000000-0000-4000-8000-000000000005','ACTIVE',NOW() - INTERVAL '1 year',NULL);
SQL

# Build the REAL /auth/me canonical read-model schema. Without these
# companion tables the prior HTTP tests only exercised its legacy SELECT *
# fallback, masking bugs in the production three-way read path.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.users ADD COLUMN email TEXT;
ALTER TABLE public.users ADD COLUMN nome TEXT;
ALTER TABLE public.users ADD COLUMN cognome TEXT;
ALTER TABLE public.users ADD COLUMN is_dpo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN genere TEXT;
ALTER TABLE public.users ADD COLUMN data_nascita DATE;
ALTER TABLE public.users ADD COLUMN cittadinanza TEXT;
ALTER TABLE public.users ADD COLUMN paese_residenza TEXT;
ALTER TABLE public.users ADD COLUMN regione_residenza TEXT;
ALTER TABLE public.users ADD COLUMN provincia_residenza TEXT;
ALTER TABLE public.users ADD COLUMN comune_residenza TEXT;
ALTER TABLE public.users ADD COLUMN paese_elezione TEXT;
ALTER TABLE public.users ADD COLUMN regione_elezione TEXT;
ALTER TABLE public.users ADD COLUMN provincia_elezione TEXT;
ALTER TABLE public.users ADD COLUMN comune_elezione TEXT;
ALTER TABLE public.users ADD COLUMN paese_candidatura TEXT;
ALTER TABLE public.users ADD COLUMN regione_candidatura TEXT;
ALTER TABLE public.users ADD COLUMN provincia_candidatura TEXT;
ALTER TABLE public.users ADD COLUMN comune_candidatura TEXT;
ALTER TABLE public.users ADD COLUMN grado_elezione TEXT;
ALTER TABLE public.users ADD COLUMN grado_candidatura TEXT;
ALTER TABLE public.users ADD COLUMN rappresentante_europeo TEXT;
ALTER TABLE public.users ADD COLUMN rappresentante_camera TEXT;
ALTER TABLE public.users ADD COLUMN rappresentante_senato TEXT;
ALTER TABLE public.users ADD COLUMN rappresentante_regionale TEXT;
ALTER TABLE public.users ADD COLUMN rappresentante_comune TEXT;
ALTER TABLE public.users ADD COLUMN candidato_europeo TEXT;
ALTER TABLE public.users ADD COLUMN candidato_camera TEXT;
ALTER TABLE public.users ADD COLUMN candidato_senato TEXT;
ALTER TABLE public.users ADD COLUMN candidato_regionale TEXT;
ALTER TABLE public.users ADD COLUMN candidato_comune TEXT;
ALTER TABLE public.users ADD COLUMN facebook_url TEXT;
ALTER TABLE public.users ADD COLUMN twitter_url TEXT;
ALTER TABLE public.users ADD COLUMN instagram_url TEXT;
ALTER TABLE public.users ADD COLUMN linkedin_url TEXT;
ALTER TABLE public.users ADD COLUMN telegram_url TEXT;
ALTER TABLE public.users ADD COLUMN website_url TEXT;
ALTER TABLE public.users ADD COLUMN twitch_url TEXT;
ALTER TABLE public.users ADD COLUMN youtube_url TEXT;
CREATE TABLE public.user_profile (
  user_id UUID PRIMARY KEY REFERENCES public.users(id),
  genere TEXT,
  data_nascita DATE,
  cittadinanza TEXT,
  paese_residenza TEXT,
  regione_residenza TEXT,
  provincia_residenza TEXT,
  comune_residenza TEXT,
  paese_elezione TEXT,
  regione_elezione TEXT,
  provincia_elezione TEXT,
  comune_elezione TEXT,
  paese_candidatura TEXT,
  regione_candidatura TEXT,
  provincia_candidatura TEXT,
  comune_candidatura TEXT,
  grado_elezione TEXT,
  grado_candidatura TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  telegram_url TEXT,
  website_url TEXT,
  twitch_url TEXT,
  youtube_url TEXT
);
CREATE TABLE public.user_representatives (
  user_id UUID PRIMARY KEY REFERENCES public.users(id),
  rappresentante_europeo TEXT,
  rappresentante_camera TEXT,
  rappresentante_senato TEXT,
  rappresentante_regionale TEXT,
  rappresentante_comune TEXT,
  candidato_europeo TEXT,
  candidato_camera TEXT,
  candidato_senato TEXT,
  candidato_regionale TEXT,
  candidato_comune TEXT
);
-- Synthetic override from profile table must win over nullable users field.
INSERT INTO public.user_profile (user_id,genere,regione_residenza)
VALUES ('00000000-0000-4000-8000-000000000004','M','Toscana');
INSERT INTO public.user_representatives (user_id,rappresentante_camera)
VALUES ('00000000-0000-4000-8000-000000000004','synthetic-choice');
SQL

psql -X -v ON_ERROR_STOP=1 -f api/database/users-role-default-e-20261029.sql
psql -X -v ON_ERROR_STOP=1 -f api/database/users-account-type-poe-20261029.sql

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
BEGIN
  IF NOT (EXISTS (SELECT 1
     FROM pg_proc p CROSS JOIN LATERAL unnest(p.proconfig) AS cfg(setting)
     WHERE p.oid='public.refresh_users_legacy_role(uuid)'::regprocedure
       AND cfg.setting='search_path=public, pg_temp')) THEN RAISE EXCEPTION 'Forward migration lost function search_path'; END IF;
  IF (SELECT COUNT(*) FROM public.users) <> 5
    OR (SELECT COUNT(*) FROM public.users WHERE account_type='P') <> 3
    OR (SELECT COUNT(*) FROM public.users WHERE account_type='O') <> 1
    OR (SELECT COUNT(*) FROM public.users WHERE account_type='E') <> 1 THEN
    RAISE EXCEPTION 'Unexpected account types after migration';
  END IF;
  IF (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000001') <> 'P'
    OR (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000005') <> 'CP'
    OR (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000004') <> 'I' THEN
    RAISE EXCEPTION 'Historical role was changed unexpectedly';
  END IF;
END $verify$;

INSERT INTO public.users(id, status) VALUES
('00000000-0000-4000-8000-000000000006','a');
DO $verify$
BEGIN
  IF (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000006') <> 'E'
    OR (SELECT account_type FROM public.users WHERE id='00000000-0000-4000-8000-000000000006') <> 'P' THEN
    RAISE EXCEPTION 'E/P defaults not applied';
  END IF;
END $verify$;

UPDATE public.users SET is_activist=true
WHERE id='00000000-0000-4000-8000-000000000006';
DO $verify$
BEGIN
 IF (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000006') <> 'A'
 THEN RAISE EXCEPTION 'Updated capability trigger failed'; END IF;
END $verify$;
SQL


# Refreshing an unrelated capability must not silently downgrade politicians
# whose only mandate evidence is historical LEGACY_BACKFILL.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
UPDATE public.users SET is_activist = true
WHERE id IN ('00000000-0000-4000-8000-000000000001',
             '00000000-0000-4000-8000-000000000005');
DO $political_role_guard$
BEGIN
 IF (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000001') <> 'P'
 OR (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000005') <> 'CP'
 THEN
   RAISE EXCEPTION 'Capability refresh downgraded P or CP with unverified political history';
 END IF;
END;
$political_role_guard$;
SQL

node api/tests/compactAccountTypes.pg17.integration.js short
node api/tests/compactAccountTypesHttp.pg17.integration.js short
node api/tests/compactAccountTypesSurvey.pg17.integration.js short

# Verify the complete rollback AFTER the compact schema has accepted a new user.
psql -X -v ON_ERROR_STOP=1 -f api/database/users-account-type-poe-rollback-20261029.sql

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
BEGIN
  IF NOT (EXISTS (SELECT 1
     FROM pg_proc p CROSS JOIN LATERAL unnest(p.proconfig) AS cfg(setting)
     WHERE p.oid='public.refresh_users_legacy_role(uuid)'::regprocedure
       AND cfg.setting='search_path=public, pg_temp')) THEN RAISE EXCEPTION 'Rollback lost function search_path'; END IF;
  IF POSITION('LEGACY_BACKFILL' IN
    pg_get_functiondef('public.refresh_users_legacy_role(uuid)'::regprocedure)) <> 0
  THEN RAISE EXCEPTION 'Rollback restored filtered mandates, not production historical semantics'; END IF;
  IF (SELECT COUNT(*) FROM public.users) <> 6
    OR (SELECT COUNT(*) FROM public.users WHERE account_type='PERSON') <> 4
    OR (SELECT COUNT(*) FROM public.users WHERE account_type='ORGANIZATION') <> 1
    OR (SELECT COUNT(*) FROM public.users WHERE account_type='INSTITUTION') <> 1 THEN
    RAISE EXCEPTION 'Rollback failed to restore descriptive values';
  END IF;
  IF (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000001') <> 'P'
    OR (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000005') <> 'CP'
    OR (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000006') <> 'A'
  THEN RAISE EXCEPTION 'Rollback altered user roles'; END IF;
END $verify$;

-- An insert after rollback must use descriptive account_type but role E.
INSERT INTO public.users(id,status) VALUES
('00000000-0000-4000-8000-000000000007','a');
DO $verify$
BEGIN
  IF (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000007') <> 'E'
    OR (SELECT account_type FROM public.users WHERE id='00000000-0000-4000-8000-000000000007') <> 'PERSON'
    OR (SELECT status FROM public.users WHERE id='00000000-0000-4000-8000-000000000007') <> 'a'
  THEN RAISE EXCEPTION 'Rollback default failed'; END IF;
END $verify$;

UPDATE public.users SET is_admin=true
WHERE id='00000000-0000-4000-8000-000000000006';
DO $verify$
BEGIN
  IF (SELECT ruolo FROM public.users WHERE id='00000000-0000-4000-8000-000000000006') <> 'AD'
  THEN RAISE EXCEPTION 'Restored legacy projection trigger failed'; END IF;
END $verify$;
SQL

# In production, ACTIVE legacy-import mandates are valid inputs to the OLD
# legacy-role projection, even if they are not proof of current public office.
# Exercise the role projection after ROLLBACK: a snapshot-only test would miss
# a subsequent-downgrade regression.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
UPDATE public.users SET is_activist = false
WHERE id IN ('00000000-0000-4000-8000-000000000001',
             '00000000-0000-4000-8000-000000000005');
DO $verify$
BEGIN
 IF (SELECT ruolo FROM public.users
     WHERE id='00000000-0000-4000-8000-000000000001') <> 'P'
 OR (SELECT ruolo FROM public.users
     WHERE id='00000000-0000-4000-8000-000000000005') <> 'CP'
 THEN RAISE EXCEPTION 'Post-rollback capability update downgraded historical P/CP'; END IF;
END;
$verify$;
SQL

node api/tests/compactAccountTypes.pg17.integration.js long
node api/tests/compactAccountTypesHttp.pg17.integration.js long
node api/tests/compactAccountTypesSurvey.pg17.integration.js long
