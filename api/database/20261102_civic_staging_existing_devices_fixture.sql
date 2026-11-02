-- DEMOS civic staging-only source fixture when the GDPR synthetic user_devices table
-- ALREADY EXISTS. Never apply to production. Creates only three missing source
-- tables and the missing users.status column; keeps existing users and devices.
-- No account, token, initiative, outbox event or Firebase message is created.
--
-- Execute only in the verified Supabase Demos-Staging project in ONE transaction:
-- BEGIN;
-- SET LOCAL civic.fixture_environment = 'staging';
-- SET LOCAL civic.fixture_approval = 'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA';
-- [paste SQL below]
-- COMMIT;
--
-- GUC approval is only an anti-accident barrier, not project authentication.
DO $guard$
BEGIN
  IF current_setting('civic.fixture_environment', TRUE)
       IS DISTINCT FROM 'staging'
     OR current_setting('civic.fixture_approval', TRUE)
       IS DISTINCT FROM 'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA'
  THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_EXPLICIT_APPROVAL_REQUIRED';
  END IF;

  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.user_devices') IS NULL
  THEN
    RAISE EXCEPTION 'CIVIC_STAGING_EXISTING_USERS_AND_DEVICES_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'eci', 'iniziative_ministero', 'notifiche_preferenze',
        'civic_new_initiative_notifications',
        'civic_push_delivery_guard', 'civic_runtime_identity'
      )
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_PARTIAL_SCHEMA_REFUSED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('id', 'bigint'),
      ('user_id', 'uuid'),
      ('fcm_token', 'text'),
      ('platform', 'text'),
      ('is_active', 'boolean'),
      ('last_seen_at', 'timestamp with time zone'),
      ('created_at', 'timestamp with time zone'),
      ('updated_at', 'timestamp with time zone')
    ) AS expected(name, data_type)
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = 'user_devices'
     AND c.column_name = expected.name
    WHERE c.column_name IS NULL OR c.data_type <> expected.data_type
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'users'
      AND c.column_name = 'id' AND c.data_type = 'uuid'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'users'
      AND c.column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_SOURCE_SCHEMA_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.user_devices'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.users'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_RLS_REQUIRED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_devices LIMIT 1) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_EXISTING_DEVICES_NOT_EMPTY';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles AS r
    WHERE r.rolname IN ('anon', 'authenticated')
      AND (
        has_table_privilege(r.oid, 'public.user_devices'::regclass, 'SELECT')
        OR has_table_privilege(r.oid, 'public.user_devices'::regclass, 'INSERT')
        OR has_table_privilege(r.oid, 'public.user_devices'::regclass, 'UPDATE')
        OR has_table_privilege(r.oid, 'public.user_devices'::regclass, 'DELETE')
      )
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_FIXTURE_DEVICE_TABLE_EXPOSED';
  END IF;
END
$guard$;

-- Match the production column type and default; existing test users remain
-- pending, not active, until explicitly activated during isolated device tests.
ALTER TABLE public.users ADD COLUMN status VARCHAR DEFAULT 'pending';

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

-- RLS and no direct Data API access for new backend-only tables.
ALTER TABLE public.eci ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iniziative_ministero ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifiche_preferenze ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eci, public.iniziative_ministero,
  public.notifiche_preferenze FROM PUBLIC;

DO $roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.eci, public.iniziative_ministero, ' ||
        'public.notifiche_preferenze FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$roles$;

COMMENT ON TABLE public.eci IS
  'DEMOS isolated civic staging source cache; empty, not for production';
COMMENT ON TABLE public.iniziative_ministero IS
  'DEMOS isolated civic staging source cache; empty, not for production';
COMMENT ON TABLE public.notifiche_preferenze IS
  'DEMOS isolated civic staging preferences; empty, not for production';

-- Existing user_devices, its grants, policies, constraints and comments
-- remain unchanged; no INSERT or push delivery is performed here.
