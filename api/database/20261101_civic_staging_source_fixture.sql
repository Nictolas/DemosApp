-- DEMOS civic push: staging-only SOURCE SCHEMA FIXTURE (DRAFT / NOT APPLIED).
-- This is not a production migration and is NOT a full DEMOS backend schema.
-- Four missing source tables only; no copied accounts, tokens or real initiative data.
-- Execute only in the explicitly authorized ISOLATED Demos-Staging project.
--
-- Operator must independently verify the Supabase project and, in the SAME
-- transaction, set LOCAL variables BEFORE pasting this file:
-- BEGIN;
-- SET LOCAL civic.fixture_environment = 'staging';
-- SET LOCAL civic.fixture_approval = 'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA';
-- [paste the content below, excluding these comments]
-- COMMIT;
--
-- Do NOT set these variables automatically in this file. If anything fails,
-- ROLLBACK. No script should connect to a real DEMOS database in CI.
-- The flags are an anti-accident check, NOT proof of the database's identity.

DO $guard$
BEGIN
  IF current_setting('civic.fixture_environment', TRUE)
       IS DISTINCT FROM 'staging'
     OR current_setting('civic.fixture_approval', TRUE)
       IS DISTINCT FROM 'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA'
  THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_EXPLICIT_APPROVAL_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'eci', 'iniziative_ministero', 'notifiche_preferenze', 'user_devices'
      )
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_SOURCE_TABLE_ALREADY_EXISTS';
  END IF;
END
$guard$;

-- Types/nullable fields are based on read-only schema inspection, not a data export.
CREATE TABLE public.eci (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  signature_count INTEGER,
  slug VARCHAR(255),
  updated_at TIMESTAMPTZ,
  status VARCHAR(50),
  obiettivi TEXT,
  url VARCHAR(1024),
  end_date DATE
);

CREATE TABLE public.iniziative_ministero (
  id VARCHAR(255) PRIMARY KEY,
  id_ministero VARCHAR(255),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  tipo VARCHAR(50),
  stato VARCHAR(50),
  data_inizio DATE,
  data_fine DATE,
  firme_raccolte INTEGER,
  quorum_raggiunto BOOLEAN,
  sito_web TEXT,
  dati_raw JSONB,
  data_ultimo_aggiornamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  esito VARCHAR(100)
);

CREATE TABLE public.notifiche_preferenze (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  demos BOOLEAN DEFAULT FALSE,
  istituzione BOOLEAN DEFAULT FALSE,
  animali BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  eurodeputato BOOLEAN DEFAULT FALSE,
  senatore BOOLEAN DEFAULT FALSE,
  deputato BOOLEAN DEFAULT FALSE,
  consigliere_regionale BOOLEAN DEFAULT FALSE,
  consigliere_comunale BOOLEAN DEFAULT FALSE,
  attivisti BOOLEAN DEFAULT FALSE,
  scuola BOOLEAN DEFAULT FALSE,
  organizzazioni BOOLEAN DEFAULT FALSE
);

CREATE TABLE public.user_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  fcm_token TEXT NOT NULL,
  platform TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No public client policies are created: RLS denies direct rows by default.
-- Do not enable Data API access before a separate authorization/RLS review.
ALTER TABLE public.eci ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iniziative_ministero ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifiche_preferenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eci, public.iniziative_ministero,
  public.notifiche_preferenze, public.user_devices FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.user_devices_id_seq FROM PUBLIC;

-- Supabase may grant anon/authenticated directly through default privileges.
-- Revoke those grants when the roles exist, including sequence permissions.
DO $roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.eci, public.iniziative_ministero, ' ||
        'public.notifiche_preferenze, public.user_devices FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL ON SEQUENCE public.user_devices_id_seq FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$roles$;

COMMENT ON TABLE public.eci IS
  'DEMOS isolated civic staging fixture; empty source cache; not for production';
COMMENT ON TABLE public.iniziative_ministero IS
  'DEMOS isolated civic staging fixture; empty source cache; not for production';
COMMENT ON TABLE public.notifiche_preferenze IS
  'DEMOS isolated civic staging fixture; no real accounts; not for production';
COMMENT ON TABLE public.user_devices IS
  'DEMOS isolated civic staging fixture; no real FCM tokens; not for production';

-- Intentionally no INSERT or notification/FCM action.
-- The three civic tables and three opt-in columns belong to the separate
-- proposed migration, only after isolated staging setup is authorized.
