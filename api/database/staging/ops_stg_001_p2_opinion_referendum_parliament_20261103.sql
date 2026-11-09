-- OPS-STG-001 P2 additive staging-only schema; derived from production metadata; no row data imported.
-- These legacy opinion and vote tables are empty in staging: application fixtures still required.
-- Rerunning this migration is intentionally blocked; do not execute on production.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.civic_runtime_identity WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1 THEN RAISE EXCEPTION 'Wrong Demos-Staging identity'; END IF;
  IF to_regclass('public.users') IS NULL OR to_regclass('public.votazioni_parlamento') IS NULL THEN RAISE EXCEPTION 'Missing prerequisites'; END IF;
  IF to_regclass('public.opinioni_domande') IS NOT NULL THEN RAISE EXCEPTION 'Target already exists: opinioni_domande'; END IF;
  IF to_regclass('public.voti_referendum_abrogativi') IS NOT NULL THEN RAISE EXCEPTION 'Target already exists: voti_referendum_abrogativi'; END IF;
  IF to_regclass('public.notifiche_voti_parlamento') IS NOT NULL THEN RAISE EXCEPTION 'Target already exists: notifiche_voti_parlamento'; END IF;
  IF to_regclass('public.voti_camera') IS NOT NULL THEN RAISE EXCEPTION 'Target already exists: voti_camera'; END IF;
  IF to_regclass('public.voti_camera_id_seq') IS NOT NULL THEN RAISE EXCEPTION 'Target already exists: voti_camera_id_seq'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_camera') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_camera'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_camera_politico') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_camera_politico'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_data') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_data'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_data_creazione') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_data_creazione'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_id_utente') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_id_utente'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_id_utente_data') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_id_utente_data'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_politico') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_politico'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_utente_hash') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_utente_hash'; END IF;
  IF to_regclass('public.idx_notifiche_voti_parlamento_votazione_hash') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_notifiche_voti_parlamento_votazione_hash'; END IF;
  IF to_regclass('public.idx_voti_camera_camera') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_voti_camera_camera'; END IF;
  IF to_regclass('public.idx_voti_camera_data_votazione') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_voti_camera_data_votazione'; END IF;
  IF to_regclass('public.idx_voti_camera_foto_url') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_voti_camera_foto_url'; END IF;
  IF to_regclass('public.idx_voti_camera_politico_nome') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_voti_camera_politico_nome'; END IF;
  IF to_regclass('public.idx_voti_camera_ultimo_aggiornamento') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_voti_camera_ultimo_aggiornamento'; END IF;
  IF to_regclass('public.idx_voti_camera_votazione_id') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_voti_camera_votazione_id'; END IF;
  IF to_regclass('public.idx_voti_camera_votazione_id_data') IS NOT NULL THEN RAISE EXCEPTION 'Index already exists: idx_voti_camera_votazione_id_data'; END IF;
END $$;
CREATE SEQUENCE public.voti_camera_id_seq;
CREATE TABLE public."opinioni_domande" (
 "id" varchar NOT NULL,
 "text" text NOT NULL,
 "gradi_opinione" text[] NOT NULL,
 "approfondimento" text
);
CREATE TABLE public."voti_referendum_abrogativi" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "userid" uuid NOT NULL,
 "referendum_id" text NOT NULL,
 "timestamp" timestamp DEFAULT now(),
 "created_at" timestamp DEFAULT now(),
 "updated_at" timestamp DEFAULT now()
);
CREATE TABLE public."notifiche_voti_parlamento" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "id_utente" uuid,
 "politico" varchar(255) NOT NULL,
 "camera" varchar(50) NOT NULL,
 "titolo" text NOT NULL,
 "testo" text,
 "voto" varchar(50) NOT NULL,
 "data" date,
 "data_creazione" timestamp DEFAULT CURRENT_TIMESTAMP,
 "votazione_hash" varchar(255),
 "likes" integer DEFAULT 0,
 "dislikes" integer DEFAULT 0
);
CREATE TABLE public."voti_camera" (
 "id" integer NOT NULL DEFAULT nextval('public.voti_camera_id_seq'::regclass),
 "politico_nome" varchar(255) NOT NULL,
 "data_votazione" date,
 "ultimo_aggiornamento" timestamp DEFAULT CURRENT_TIMESTAMP,
 "camera" varchar(50),
 "url_openpolis" text,
 "voto" varchar(50),
 "votazione_id" integer,
 "foto_url" text
);
ALTER TABLE public."notifiche_voti_parlamento" ADD CONSTRAINT "notifiche_voti_parlamento_pkey" PRIMARY KEY (id);
ALTER TABLE public."opinioni_domande" ADD CONSTRAINT "opinioni_domande_pkey" PRIMARY KEY (id);
ALTER TABLE public."voti_camera" ADD CONSTRAINT "voti_camera_pkey" PRIMARY KEY (id);
ALTER TABLE public."voti_referendum_abrogativi" ADD CONSTRAINT "voti_referendum_abrogativi_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifiche_voti_parlamento" ADD CONSTRAINT "notifiche_voti_parlamento_votazione_hash_key" UNIQUE (votazione_hash);
ALTER TABLE public."voti_camera" ADD CONSTRAINT "voti_camera_politico_nome_key" UNIQUE (politico_nome);
ALTER TABLE public."voti_referendum_abrogativi" ADD CONSTRAINT "voti_referendum_abrogativi_userid_referendum_id_key" UNIQUE (userid, referendum_id);
ALTER TABLE public."notifiche_voti_parlamento" ADD CONSTRAINT "notifiche_voti_parlamento_camera_check" CHECK (((camera)::text = ANY (ARRAY[('Camera'::character varying)::text, ('Senato'::character varying)::text])));
ALTER TABLE public."notifiche_voti_parlamento" ADD CONSTRAINT "notifiche_voti_parlamento_voto_check" CHECK (((voto)::text = ANY (ARRAY[('Favorevole'::character varying)::text, ('Contrario'::character varying)::text, ('Astenuto'::character varying)::text, ('In missione'::character varying)::text])));
ALTER TABLE public."voti_camera" ADD CONSTRAINT "voti_camera_camera_check" CHECK (((camera)::text = ANY (ARRAY[('Camera'::character varying)::text, ('Senato'::character varying)::text])));
ALTER TABLE public."voti_camera" ADD CONSTRAINT "voti_camera_voto_check" CHECK (((voto)::text = ANY (ARRAY[('In missione'::character varying)::text, ('Astenuto'::character varying)::text, ('Favorevole'::character varying)::text, ('Contrario'::character varying)::text])));
ALTER TABLE public."notifiche_voti_parlamento" ADD CONSTRAINT "notifiche_voti_parlamento_id_utente_fkey" FOREIGN KEY (id_utente) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."voti_camera" ADD CONSTRAINT "voti_camera_votazione_id_fkey" FOREIGN KEY (votazione_id) REFERENCES votazioni_parlamento(id) ON DELETE SET NULL;
ALTER TABLE public."voti_referendum_abrogativi" ADD CONSTRAINT "voti_referendum_abrogativi_userid_fkey" FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE;
ALTER SEQUENCE public.voti_camera_id_seq OWNED BY public.voti_camera.id;
CREATE INDEX idx_notifiche_voti_parlamento_camera ON public.notifiche_voti_parlamento USING btree (camera);
CREATE INDEX idx_notifiche_voti_parlamento_camera_politico ON public.notifiche_voti_parlamento USING btree (camera, politico);
CREATE INDEX idx_notifiche_voti_parlamento_data ON public.notifiche_voti_parlamento USING btree (data DESC);
CREATE INDEX idx_notifiche_voti_parlamento_data_creazione ON public.notifiche_voti_parlamento USING btree (data_creazione DESC);
CREATE INDEX idx_notifiche_voti_parlamento_id_utente ON public.notifiche_voti_parlamento USING btree (id_utente);
CREATE INDEX idx_notifiche_voti_parlamento_id_utente_data ON public.notifiche_voti_parlamento USING btree (id_utente, data_creazione DESC);
CREATE INDEX idx_notifiche_voti_parlamento_politico ON public.notifiche_voti_parlamento USING btree (politico);
CREATE INDEX idx_notifiche_voti_parlamento_utente_hash ON public.notifiche_voti_parlamento USING btree (id_utente, votazione_hash);
CREATE INDEX idx_notifiche_voti_parlamento_votazione_hash ON public.notifiche_voti_parlamento USING btree (votazione_hash);
CREATE INDEX idx_voti_camera_camera ON public.voti_camera USING btree (camera);
CREATE INDEX idx_voti_camera_data_votazione ON public.voti_camera USING btree (data_votazione DESC);
CREATE INDEX idx_voti_camera_foto_url ON public.voti_camera USING btree (foto_url) WHERE (foto_url IS NOT NULL);
CREATE INDEX idx_voti_camera_politico_nome ON public.voti_camera USING btree (politico_nome);
CREATE INDEX idx_voti_camera_ultimo_aggiornamento ON public.voti_camera USING btree (ultimo_aggiornamento DESC);
CREATE INDEX idx_voti_camera_votazione_id ON public.voti_camera USING btree (votazione_id);
CREATE INDEX idx_voti_camera_votazione_id_data ON public.voti_camera USING btree (votazione_id, data_votazione DESC) WHERE (votazione_id IS NOT NULL);
ALTER TABLE public."opinioni_domande" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."voti_referendum_abrogativi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifiche_voti_parlamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."voti_camera" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."opinioni_domande", public."voti_referendum_abrogativi", public."notifiche_voti_parlamento", public."voti_camera" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.voti_camera_id_seq FROM PUBLIC, anon, authenticated;
COMMIT;
