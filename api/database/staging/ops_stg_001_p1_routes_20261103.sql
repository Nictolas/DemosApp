-- OPS-STG-001 / Demos-Staging P1: additive *empty* route tables from production schema metadata.
-- Intent: auth sessions, civic ICE, communications, candidacies, mandates, electoral units, parliamentary records.
-- Never copy production data or run against the production project. Runtime app remains bootstrap-only.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.civic_runtime_identity WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1 THEN
  RAISE EXCEPTION 'STOP: not authorized Demos-Staging database identity';
 END IF;
 IF to_regclass('public.users') IS NULL OR to_regclass('public.eventi') IS NULL THEN
  RAISE EXCEPTION 'STOP: staging prerequisite tables missing';
 END IF;
 IF to_regclass('public.active_sessions') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing active_sessions'; END IF;
 IF to_regclass('public.ice') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing ice'; END IF;
 IF to_regclass('public.comunicazioni') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing comunicazioni'; END IF;
 IF to_regclass('public.unita_elettorale') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing unita_elettorale'; END IF;
 IF to_regclass('public.candidati') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing candidati'; END IF;
 IF to_regclass('public.political_candidacies') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing political_candidacies'; END IF;
 IF to_regclass('public.political_mandates') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing political_mandates'; END IF;
 IF to_regclass('public.parlamento') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing parlamento'; END IF;
 IF to_regclass('public.votazioni_parlamento') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing votazioni_parlamento'; END IF;
 IF to_regclass('public.parlamento_id_seq') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing parlamento_id_seq'; END IF;
 IF to_regclass('public.votazioni_parlamento_id_seq') IS NOT NULL THEN RAISE EXCEPTION 'STOP: pre-existing votazioni_parlamento_id_seq'; END IF;
END $$;
CREATE SEQUENCE public.parlamento_id_seq;
CREATE SEQUENCE public.votazioni_parlamento_id_seq;
CREATE TABLE public."active_sessions" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "user_id" varchar(255) NOT NULL,
 "session_token" varchar(500) NOT NULL,
 "ip_address" varchar(45),
 "user_agent" text,
 "login_time" timestamptz DEFAULT CURRENT_TIMESTAMP,
 "last_activity" timestamptz DEFAULT CURRENT_TIMESTAMP,
 "is_active" boolean DEFAULT true,
 "expires_at" timestamptz,
 "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public."ice" (
 "id" varchar(255) NOT NULL,
 "descrizione" text,
 "data_creazione" timestamptz DEFAULT CURRENT_TIMESTAMP,
 "quorum" varchar(20),
 "nome" text,
 "votiices" integer DEFAULT 0,
 "datainizio" date,
 "datafine" date,
 "sitoweb" text,
 "firme" integer DEFAULT 0,
 "esito" varchar(50) DEFAULT NULL::character varying
);
CREATE TABLE public."comunicazioni" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "id_utente" uuid,
 "titolo" text NOT NULL,
 "testo" text,
 "zona" text,
 "voto_dato" varchar(50),
 "vincitore" varchar(50),
 "commento" text,
 "data_creazione" timestamptz NOT NULL DEFAULT now(),
 "likes" integer NOT NULL DEFAULT 0,
 "dislikes" integer NOT NULL DEFAULT 0,
 "punti_trasparenza" integer NOT NULL DEFAULT 0,
 "read_by" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
 "tipo" varchar(30) DEFAULT 'comunicazione'::character varying,
 "institutional_level" varchar(20),
 "vote_date" date,
 "source_vote_id" text,
 "institutional_vote_key" varchar(64)
);
CREATE TABLE public."unita_elettorale" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "nome" text NOT NULL,
 "tipo" text NOT NULL,
 "evento_id" uuid NOT NULL,
 "code" text,
 "label" text,
 "unit_type" text,
 "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public."candidati" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "user_id" uuid NOT NULL,
 "evento_id" uuid NOT NULL,
 "unita_elettorale_id" uuid NOT NULL
);
CREATE TABLE public."political_candidacies" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "user_id" uuid NOT NULL,
 "election_event_id" uuid,
 "electoral_unit_id" uuid,
 "jurisdiction" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'::character varying,
 "starts_at" timestamptz NOT NULL DEFAULT now(),
 "ends_at" timestamptz,
 "result" varchar(20),
 "source" varchar(30) NOT NULL DEFAULT 'DEMOS'::character varying,
 "legacy_context" jsonb,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."political_mandates" (
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "user_id" uuid NOT NULL,
 "election_event_id" uuid,
 "office_code" text,
 "institution_code" text,
 "jurisdiction" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'::character varying,
 "starts_at" timestamptz NOT NULL DEFAULT now(),
 "ends_at" timestamptz,
 "source" varchar(30) NOT NULL DEFAULT 'DEMOS'::character varying,
 "legacy_context" jsonb,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."parlamento" (
 "id" integer NOT NULL DEFAULT nextval('public.parlamento_id_seq'::regclass),
 "uri" text NOT NULL,
 "votazione_id" text,
 "camera" varchar(50) NOT NULL,
 "titolo" text NOT NULL,
 "descrizione" text,
 "data_votazione" date,
 "esito" varchar(50),
 "uri_seduta" text,
 "numero_seduta" text,
 "titolo_seduta" text,
 "legislatura" integer,
 "favorevoli" integer,
 "contrari" integer,
 "presenti" integer,
 "votanti" integer,
 "maggioranza" integer,
 "tipo_votazione" text,
 "approvato" integer,
 "metadati" jsonb DEFAULT '{}'::jsonb,
 "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
 "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
 "data_sincronizzazione" timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public."votazioni_parlamento" (
 "id" integer NOT NULL DEFAULT nextval('public.votazioni_parlamento_id_seq'::regclass),
 "titolo_votazione" text NOT NULL,
 "descrizione_votazione" text,
 "camera" varchar(50) NOT NULL,
 "data_votazione" date,
 "spiegazione" text,
 "votazione_hash" varchar(255),
 "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
 "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
 "url_votazione" text,
 "numero_seduta" integer,
 "tipo_atto" varchar(50),
 "sigla_atto" varchar(20),
 "numero_atto" integer
);
ALTER TABLE public."active_sessions" ADD CONSTRAINT "active_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."active_sessions" ADD CONSTRAINT "active_sessions_session_token_key" UNIQUE (session_token);
ALTER TABLE public."candidati" ADD CONSTRAINT "candidati_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES eventi(id);
ALTER TABLE public."candidati" ADD CONSTRAINT "candidati_unita_elettorale_id_fkey" FOREIGN KEY (unita_elettorale_id) REFERENCES unita_elettorale(id);
ALTER TABLE public."candidati" ADD CONSTRAINT "candidati_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."candidati" ADD CONSTRAINT "candidati_pkey" PRIMARY KEY (id);
ALTER TABLE public."comunicazioni" ADD CONSTRAINT "comunicazioni_institutional_level_check" CHECK (((institutional_level IS NULL) OR ((institutional_level)::text = ANY ((ARRAY['EUROPEO'::character varying, 'CAMERA'::character varying, 'SENATO'::character varying, 'REGIONE'::character varying, 'COMUNE'::character varying])::text[]))));
ALTER TABLE public."comunicazioni" ADD CONSTRAINT "comunicazioni_vincitore_check" CHECK (((vincitore IS NULL) OR ((vincitore)::text = ANY ((ARRAY['Favorevole'::character varying, 'Contrario'::character varying, 'Astenuto'::character varying])::text[]))));
ALTER TABLE public."comunicazioni" ADD CONSTRAINT "comunicazioni_voto_dato_check" CHECK (((voto_dato IS NULL) OR ((voto_dato)::text = ANY ((ARRAY['Favorevole'::character varying, 'Contrario'::character varying, 'Astenuto'::character varying])::text[]))));
ALTER TABLE public."comunicazioni" ADD CONSTRAINT "comunicazioni_id_utente_fkey" FOREIGN KEY (id_utente) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public."comunicazioni" ADD CONSTRAINT "comunicazioni_pkey1" PRIMARY KEY (id);
ALTER TABLE public."ice" ADD CONSTRAINT "ice_pkey" PRIMARY KEY (id);
ALTER TABLE public."parlamento" ADD CONSTRAINT "parlamento_camera_check" CHECK (((camera)::text = ANY (ARRAY[('Camera'::character varying)::text, ('Senato'::character varying)::text])));
ALTER TABLE public."parlamento" ADD CONSTRAINT "parlamento_pkey" PRIMARY KEY (id);
ALTER TABLE public."parlamento" ADD CONSTRAINT "parlamento_uri_key" UNIQUE (uri);
ALTER TABLE public."political_candidacies" ADD CONSTRAINT "political_candidacies_check" CHECK (((ends_at IS NULL) OR (ends_at >= starts_at)));
ALTER TABLE public."political_candidacies" ADD CONSTRAINT "political_candidacies_result_check" CHECK (((result IS NULL) OR ((result)::text = ANY ((ARRAY['ELECTED'::character varying, 'NOT_ELECTED'::character varying, 'UNKNOWN'::character varying])::text[]))));
ALTER TABLE public."political_candidacies" ADD CONSTRAINT "political_candidacies_status_check" CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'WITHDRAWN'::character varying, 'ENDED'::character varying, 'CANCELLED'::character varying])::text[])));
ALTER TABLE public."political_candidacies" ADD CONSTRAINT "political_candidacies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."political_candidacies" ADD CONSTRAINT "political_candidacies_pkey" PRIMARY KEY (id);
ALTER TABLE public."political_mandates" ADD CONSTRAINT "political_mandates_check" CHECK (((ends_at IS NULL) OR (ends_at >= starts_at)));
ALTER TABLE public."political_mandates" ADD CONSTRAINT "political_mandates_status_check" CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ENDED'::character varying, 'CANCELLED'::character varying])::text[])));
ALTER TABLE public."political_mandates" ADD CONSTRAINT "political_mandates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."political_mandates" ADD CONSTRAINT "political_mandates_pkey" PRIMARY KEY (id);
ALTER TABLE public."unita_elettorale" ADD CONSTRAINT "unita_elettorale_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES eventi(id);
ALTER TABLE public."unita_elettorale" ADD CONSTRAINT "unita_elettorale_pkey" PRIMARY KEY (id);
ALTER TABLE public."votazioni_parlamento" ADD CONSTRAINT "votazioni_parlamento_camera_check" CHECK (((camera)::text = ANY (ARRAY[('Camera'::character varying)::text, ('Senato'::character varying)::text])));
ALTER TABLE public."votazioni_parlamento" ADD CONSTRAINT "votazioni_parlamento_pkey" PRIMARY KEY (id);
ALTER TABLE public."votazioni_parlamento" ADD CONSTRAINT "votazioni_parlamento_votazione_hash_key" UNIQUE (votazione_hash);
ALTER SEQUENCE public.parlamento_id_seq OWNED BY public."parlamento"."id";
ALTER SEQUENCE public.votazioni_parlamento_id_seq OWNED BY public."votazioni_parlamento"."id";
CREATE INDEX idx_active_sessions_expires_at ON public.active_sessions USING btree (expires_at);
CREATE INDEX idx_active_sessions_is_active ON public.active_sessions USING btree (is_active);
CREATE INDEX idx_active_sessions_last_activity ON public.active_sessions USING btree (last_activity);
CREATE INDEX idx_active_sessions_user_id ON public.active_sessions USING btree (user_id);
CREATE INDEX idx_comunicazioni_created ON public.comunicazioni USING btree (data_creazione DESC);
CREATE INDEX idx_comunicazioni_transparency_window ON public.comunicazioni USING btree (institutional_level, vote_date DESC, id_utente) WHERE (((tipo)::text = 'votazione'::text) AND (institutional_vote_key IS NOT NULL) AND (vote_date IS NOT NULL));
CREATE INDEX idx_comunicazioni_user_created ON public.comunicazioni USING btree (id_utente, data_creazione DESC);
CREATE UNIQUE INDEX uq_comunicazioni_politician_vote_key ON public.comunicazioni USING btree (id_utente, institutional_vote_key) WHERE (institutional_vote_key IS NOT NULL);
CREATE INDEX idx_parlamento_camera ON public.parlamento USING btree (camera);
CREATE INDEX idx_parlamento_camera_data ON public.parlamento USING btree (camera, data_votazione DESC NULLS LAST);
CREATE INDEX idx_parlamento_data_sincronizzazione ON public.parlamento USING btree (data_sincronizzazione DESC);
CREATE INDEX idx_parlamento_data_votazione ON public.parlamento USING btree (data_votazione DESC);
CREATE INDEX idx_parlamento_esito ON public.parlamento USING btree (esito);
CREATE INDEX idx_parlamento_legislatura ON public.parlamento USING btree (legislatura);
CREATE INDEX idx_parlamento_metadati_gin ON public.parlamento USING gin (metadati);
CREATE INDEX idx_parlamento_numero_seduta ON public.parlamento USING btree (numero_seduta);
CREATE INDEX idx_parlamento_uri ON public.parlamento USING btree (uri);
CREATE INDEX idx_political_candidacies_election_event ON public.political_candidacies USING btree (election_event_id) WHERE (election_event_id IS NOT NULL);
CREATE INDEX idx_political_candidacies_electoral_unit ON public.political_candidacies USING btree (electoral_unit_id) WHERE (electoral_unit_id IS NOT NULL);
CREATE INDEX idx_political_candidacies_user_active ON public.political_candidacies USING btree (user_id) WHERE ((status)::text = 'ACTIVE'::text);
CREATE UNIQUE INDEX uq_political_candidacies_active_election_unit ON public.political_candidacies USING btree (user_id, election_event_id, electoral_unit_id) WHERE (((status)::text = 'ACTIVE'::text) AND (election_event_id IS NOT NULL) AND (electoral_unit_id IS NOT NULL));
CREATE UNIQUE INDEX uq_political_candidacies_legacy_active ON public.political_candidacies USING btree (user_id) WHERE (((source)::text = 'LEGACY_BACKFILL'::text) AND ((status)::text = 'ACTIVE'::text));
CREATE INDEX idx_political_mandates_election_event ON public.political_mandates USING btree (election_event_id) WHERE (election_event_id IS NOT NULL);
CREATE INDEX idx_political_mandates_office ON public.political_mandates USING btree (office_code) WHERE (office_code IS NOT NULL);
CREATE INDEX idx_political_mandates_user_active ON public.political_mandates USING btree (user_id) WHERE ((status)::text = 'ACTIVE'::text);
CREATE UNIQUE INDEX uq_political_mandates_legacy_active ON public.political_mandates USING btree (user_id) WHERE (((source)::text = 'LEGACY_BACKFILL'::text) AND ((status)::text = 'ACTIVE'::text));
CREATE INDEX idx_unita_elettorale_evento ON public.unita_elettorale USING btree (evento_id);
CREATE UNIQUE INDEX uq_unita_elettorale_evento_code ON public.unita_elettorale USING btree (evento_id, code) WHERE (code IS NOT NULL);
CREATE INDEX idx_votazioni_parlamento_camera ON public.votazioni_parlamento USING btree (camera);
CREATE INDEX idx_votazioni_parlamento_data ON public.votazioni_parlamento USING btree (data_votazione DESC);
CREATE INDEX idx_votazioni_parlamento_data_camera ON public.votazioni_parlamento USING btree (data_votazione DESC, camera) WHERE (data_votazione IS NOT NULL);
CREATE INDEX idx_votazioni_parlamento_hash ON public.votazioni_parlamento USING btree (votazione_hash);
CREATE INDEX idx_votazioni_parlamento_numero_seduta ON public.votazioni_parlamento USING btree (numero_seduta) WHERE (numero_seduta IS NOT NULL);
CREATE INDEX idx_votazioni_parlamento_spiegazione ON public.votazioni_parlamento USING btree (spiegazione) WHERE (spiegazione IS NOT NULL);
CREATE INDEX idx_votazioni_parlamento_tipo_atto ON public.votazioni_parlamento USING btree (tipo_atto) WHERE (tipo_atto IS NOT NULL);
CREATE INDEX idx_votazioni_parlamento_titolo ON public.votazioni_parlamento USING btree (titolo_votazione);
ALTER TABLE public."active_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comunicazioni" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."unita_elettorale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."candidati" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."political_candidacies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."political_mandates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."parlamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."votazioni_parlamento" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."active_sessions", public."ice", public."comunicazioni", public."unita_elettorale", public."candidati", public."political_candidacies", public."political_mandates", public."parlamento", public."votazioni_parlamento" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.parlamento_id_seq,public.votazioni_parlamento_id_seq FROM PUBLIC, anon, authenticated;
COMMIT;
