-- OPS-STG-001: only Demos-Staging, additive empty P0 application tables.
-- No production rows or personal information copied. Do not execute on production.
-- Production and staging BOTH contain civic_runtime_identity: distinguish by the
-- hashed runtime identity, not merely the table's existence.
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.civic_runtime_identity WHERE id = 1
      AND md5(db_identity::text) = '0cbb6ace68a9f11956904e2a37898ec8') != 1 THEN
    RAISE EXCEPTION 'STOP: DB is not authorized Demos-Staging';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'STOP: expected staging users table missing';
  END IF;
  IF EXISTS (
     SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('user_profile','notifiche_demos','iniziative_popolari','referendum_abrogativi')
       AND c.relkind IN ('r','p','v','m','f')
  ) THEN
    RAISE EXCEPTION 'STOP: target P0 table already exists; reconcile migration state';
  END IF;
END;
$$;

CREATE TABLE public.user_profile (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  genere text,
  data_nascita date,
  cittadinanza text,
  paese_residenza text,
  regione_residenza text,
  provincia_residenza text,
  comune_residenza text,
  grado_elezione text,
  paese_elezione text,
  regione_elezione text,
  provincia_elezione text,
  comune_elezione text,
  grado_candidatura text,
  paese_candidatura text,
  regione_candidatura text,
  provincia_candidatura text,
  comune_candidatura text,
  facebook_url text,
  twitter_url text,
  instagram_url text,
  linkedin_url text,
  telegram_url text,
  website_url text,
  twitch_url text,
  youtube_url text,
  avatar_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifiche_demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utente uuid REFERENCES public.users(id),
  titolo text,
  testo text NOT NULL,
  data_creazione timestamptz DEFAULT CURRENT_TIMESTAMP,
  data date
);

CREATE TABLE public.iniziative_popolari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  userid uuid REFERENCES public.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  data_inizio date,
  data_fine date,
  sito_web text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  accepted_at timestamp,
  descrizione text,
  sitoweb text,
  votiices integer DEFAULT 0,
  firme integer DEFAULT 0,
  esito varchar(100),
  titolo text,
  stato varchar(50) DEFAULT 'in_corso',
  quorum_raggiunto boolean DEFAULT false,
  firme_raccolte integer DEFAULT 0,
  tipo varchar(50) DEFAULT 'iniziativa',
  data_ultimo_aggiornamento timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_iniziative_popolari_esito ON public.iniziative_popolari (esito);
CREATE INDEX idx_iniziative_popolari_quorum_raggiunto ON public.iniziative_popolari (quorum_raggiunto);
CREATE INDEX idx_iniziative_popolari_stato ON public.iniziative_popolari (stato);
CREATE INDEX idx_iniziative_popolari_tipo ON public.iniziative_popolari (tipo);
CREATE INDEX idx_iniziative_popolari_titolo ON public.iniziative_popolari (titolo);

CREATE TABLE public.referendum_abrogativi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_inizio date,
  data_fine date,
  created_at timestamp DEFAULT now(),
  accepted_at timestamp,
  descrizione text,
  sitoweb text,
  votiices integer DEFAULT 0,
  firme integer DEFAULT 0,
  esito text,
  userid uuid,
  titolo text,
  stato varchar(50) DEFAULT 'in_corso',
  quorum_raggiunto boolean DEFAULT false,
  firme_raccolte integer DEFAULT 0,
  tipo varchar(50) DEFAULT 'referendum',
  data_ultimo_aggiornamento timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- These are internal staging backend tables. No direct client access.
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifiche_demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iniziative_popolari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referendum_abrogativi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_profile,public.notifiche_demos,public.iniziative_popolari,public.referendum_abrogativi
  FROM PUBLIC,anon,authenticated;
COMMIT;
