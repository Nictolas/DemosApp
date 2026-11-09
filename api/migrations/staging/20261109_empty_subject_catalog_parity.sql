-- DEMOS QA ONLY — empty compatibility schemas for the existing Demos-Staging project.
-- Source of truth: read-only pg_catalog/information_schema comparison with production
-- on 2026-11-09. NO personal rows are copied, generated or imported.
-- Run only on Demos-Staging (fkeayjzvtuvzesljhjbc), not on production.
-- All six tables must be ABSENT; abort on pre-existing schemas instead of hiding drift.
-- Separate GDPR/legal and backend feature flags remain OFF.
BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM (VALUES ('richieste_grazia'),('grazia_carcerati'),('voti_grazia'),
                   ('voti_capo_stato'),('voti_amnistia'),('amnistia')) AS names(rel)
      WHERE to_regclass('public.' || names.rel) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'QA subject catalogue parity requires all six source tables to be absent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users'
      AND column_name='id' AND udt_name='uuid'
  ) THEN
    RAISE EXCEPTION 'Expected users.id UUID missing in QA staging';
  END IF;
END
$preflight$;

CREATE TABLE public.amnistia (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legge text,
  articolo text,
  descrizione text,
  attiva boolean NOT NULL DEFAULT true,
  fonte_url text,
  precedente_storico text
);

CREATE TABLE public.grazia_carcerati (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  attivo boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX grazia_carcerati_nome_key
  ON public.grazia_carcerati (lower(btrim(nome)));

CREATE TABLE public.richieste_grazia (
  id varchar(255) PRIMARY KEY,
  utente_id varchar(255),
  nome text,
  url_prova text,
  status varchar(50) DEFAULT 'pending',
  data_creazione timestamptz DEFAULT CURRENT_TIMESTAMP,
  note text
);

CREATE TABLE public.voti_amnistia (
  id uuid,
  userid uuid,
  firestore_userid text,
  legge text,
  amnistia_id integer
);
CREATE UNIQUE INDEX voti_amnistia_userid_legge_key
  ON public.voti_amnistia (userid, legge);

CREATE TABLE public.voti_capo_stato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  userid uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  "timestamp" timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT voti_capo_stato_userid_nome_key UNIQUE (userid,nome),
  CONSTRAINT voti_capo_stato_emma_bonino_non_eleggibile
    CHECK (regexp_replace(lower(nome), '[^[:alnum:]]', '', 'g') <> 'emmabonino')
);

CREATE TABLE public.voti_grazia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  userid uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  "timestamp" timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT voti_grazia_userid_nome_key UNIQUE (userid,nome)
);

-- Production metadata confirms RLS=true and no direct SELECT grants for the
-- two client roles on these tables. Preserve the same secure posture in QA.
ALTER TABLE public.amnistia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grazia_carcerati ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.richieste_grazia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voti_amnistia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voti_capo_stato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voti_grazia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amnistia, public.grazia_carcerati, public.richieste_grazia,
  public.voti_amnistia, public.voti_capo_stato, public.voti_grazia
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.amnistia_id_seq, public.grazia_carcerati_id_seq
  FROM PUBLIC, anon, authenticated;

COMMIT;

-- Not a GO: application is still a separate process, not deployed to this QA DB.
-- Do not enable DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED, DEMOS_GRAZIA_NOMINATIONS_ENABLED
-- or FCM delivery until legal, identity, functional E2E and rollback gates pass.
