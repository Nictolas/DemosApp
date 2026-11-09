-- OPS-STG-001: P3 additive empty schema for *only* real referendum ballots, notifications and segnalazioni.
-- All DDL is locked to the unique Demos-Staging identity. NO production data, notification delivery, or backend cutover.
-- Expected: 7 tables, 78 columns, 33 constraints, 22 indexes, no triggers. Runtime remains BOOTSTRAP.
BEGIN;
SET LOCAL search_path = public,pg_catalog;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.civic_runtime_identity WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1 THEN
    RAISE EXCEPTION 'OPS_STG_P3_NOT_DEMOS_STAGING';
  END IF;
  IF (SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'OPS_STG_P3_DELIVERY_NOT_BLOCKED';
  END IF;
  IF to_regclass('public.users') IS NULL OR to_regclass('public.civic_processes') IS NULL THEN
    RAISE EXCEPTION 'OPS_STG_P3_FK_PREREQUISITE_MISSING';
  END IF;
  IF to_regclass('public.civic_ballots') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_ALREADY_EXISTS_civic_ballots'; END IF;
  IF to_regclass('public.civic_ballot_positions') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_ALREADY_EXISTS_civic_ballot_positions'; END IF;
  IF to_regclass('public.notifiche_avvistamenti') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_ALREADY_EXISTS_notifiche_avvistamenti'; END IF;
  IF to_regclass('public.notifiche_comunali') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_ALREADY_EXISTS_notifiche_comunali'; END IF;
  IF to_regclass('public.notifiche_voti_comuni') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_ALREADY_EXISTS_notifiche_voti_comuni'; END IF;
  IF to_regclass('public.political_opinion_notifications') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_ALREADY_EXISTS_political_opinion_notifications'; END IF;
  IF to_regclass('public.segnalazioni') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_ALREADY_EXISTS_segnalazioni'; END IF;
  IF to_regclass('public.civic_ballot_positions_pkey') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_civic_ballot_positions_pkey'; END IF;
  IF to_regclass('public.idx_civic_ballot_positions_choice') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_civic_ballot_positions_choice'; END IF;
  IF to_regclass('public.idx_civic_ballot_positions_user') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_civic_ballot_positions_user'; END IF;
  IF to_regclass('public.civic_ballots_civic_process_id_key') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_civic_ballots_civic_process_id_key'; END IF;
  IF to_regclass('public.civic_ballots_pkey') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_civic_ballots_pkey'; END IF;
  IF to_regclass('public.idx_civic_ballots_active') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_civic_ballots_active'; END IF;
  IF to_regclass('public.idx_notifiche_avvistamenti_comune') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_notifiche_avvistamenti_comune'; END IF;
  IF to_regclass('public.idx_notifiche_avvistamenti_data') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_notifiche_avvistamenti_data'; END IF;
  IF to_regclass('public.idx_notifiche_avvistamenti_utente') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_notifiche_avvistamenti_utente'; END IF;
  IF to_regclass('public.notifiche_avvistamenti_pkey') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_notifiche_avvistamenti_pkey'; END IF;
  IF to_regclass('public.informa_cittadini_pkey') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_informa_cittadini_pkey'; END IF;
  IF to_regclass('public.comunicazioni_pkey') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_comunicazioni_pkey'; END IF;
  IF to_regclass('public.idx_comunicazioni_utente') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_comunicazioni_utente'; END IF;
  IF to_regclass('public.idx_political_opinion_notifications_recipient_created') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_political_opinion_notifications_recipient_created'; END IF;
  IF to_regclass('public.idx_political_opinion_notifications_subject_created') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_political_opinion_notifications_subject_created'; END IF;
  IF to_regclass('public.political_opinion_notifications_pkey') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_political_opinion_notifications_pkey'; END IF;
  IF to_regclass('public.idx_segnalazioni_data_creazione') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_segnalazioni_data_creazione'; END IF;
  IF to_regclass('public.idx_segnalazioni_priorita') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_segnalazioni_priorita'; END IF;
  IF to_regclass('public.idx_segnalazioni_status') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_segnalazioni_status'; END IF;
  IF to_regclass('public.idx_segnalazioni_tipo') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_segnalazioni_tipo'; END IF;
  IF to_regclass('public.idx_segnalazioni_utente_id') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_idx_segnalazioni_utente_id'; END IF;
  IF to_regclass('public.segnalazioni_pkey') IS NOT NULL THEN RAISE EXCEPTION 'OPS_STG_P3_INDEX_COLLISION_segnalazioni_pkey'; END IF;
END $$;
CREATE TABLE public."civic_ballots" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "civic_process_id" uuid NOT NULL,
  "ballot_kind" text NOT NULL,
  "question_text" text NOT NULL,
  "yes_meaning" text NOT NULL,
  "no_meaning" text NOT NULL,
  "opens_at" timestamptz NOT NULL,
  "closes_at" timestamptz NOT NULL,
  "timezone" text NOT NULL,
  "quorum_kind" text NOT NULL DEFAULT 'none'::text,
  "quorum_threshold" numeric(7,6),
  "status" text NOT NULL DEFAULT 'scheduled'::text,
  "source_id" text NOT NULL,
  "source_url" text NOT NULL,
  "official_reference" text,
  "official_turnout_percent" numeric(6,3),
  "official_yes_percent" numeric(6,3),
  "official_no_percent" numeric(6,3),
  "official_result_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."civic_ballot_positions" (
  "civic_ballot_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "choice" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."notifiche_avvistamenti" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "id_utente" uuid NOT NULL,
  "tipo_avvistamento" varchar(100) NOT NULL,
  "comune_residenza" text NOT NULL,
  "data" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "data_creazione" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE public."notifiche_comunali" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "id_utente" uuid NOT NULL,
  "tipologia" text NOT NULL,
  "dove" text NOT NULL,
  "dal_giorno" date NOT NULL,
  "al_giorno" date NOT NULL,
  "zona" text,
  "data_creazione" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."notifiche_voti_comuni" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "titolo" varchar(255) NOT NULL,
  "id_utente" uuid NOT NULL,
  "likes" integer DEFAULT 0,
  "dislikes" integer DEFAULT 0,
  "testo" text,
  "voto" text,
  "data" date,
  "comune_residenza" text,
  "politico" text,
  "data_creazione" timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public."political_opinion_notifications" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "recipient_user_id" uuid NOT NULL,
  "subject_user_id" uuid NOT NULL,
  "opinion_id" text NOT NULL,
  "opinion_text" text NOT NULL,
  "previous_value" text NOT NULL,
  "new_value" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."segnalazioni" (
  "id" varchar(255) NOT NULL,
  "utente_id" varchar(255),
  "tipo" varchar(50) NOT NULL,
  "titolo" text NOT NULL,
  "descrizione" text NOT NULL,
  "priorita" varchar(20) DEFAULT 'medium'::character varying,
  "passaggi" text,
  "comportamento_atteso" text,
  "comportamento_effettivo" text,
  "browser" varchar(255),
  "dispositivo" varchar(255),
  "status" varchar(50) DEFAULT 'aperta'::character varying,
  "data_creazione" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "data_aggiornamento" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "data_risoluzione" timestamptz,
  "risolto_da" varchar(255),
  "note_risoluzione" text,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public."civic_ballot_positions" ADD CONSTRAINT "civic_ballot_positions_pkey" PRIMARY KEY (civic_ballot_id, user_id);
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifiche_avvistamenti" ADD CONSTRAINT "notifiche_avvistamenti_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifiche_comunali" ADD CONSTRAINT "informa_cittadini_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifiche_voti_comuni" ADD CONSTRAINT "comunicazioni_pkey" PRIMARY KEY (id);
ALTER TABLE public."political_opinion_notifications" ADD CONSTRAINT "political_opinion_notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."segnalazioni" ADD CONSTRAINT "segnalazioni_pkey" PRIMARY KEY (id);
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_civic_process_id_key" UNIQUE (civic_process_id);
ALTER TABLE public."civic_ballot_positions" ADD CONSTRAINT "civic_ballot_positions_choice_check" CHECK ((choice = ANY (ARRAY['YES'::text, 'NO'::text, 'ABSTAIN'::text])));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_ballot_kind_check" CHECK ((length(TRIM(BOTH FROM ballot_kind)) > 0));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_check" CHECK ((closes_at > opens_at));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_check1" CHECK ((((quorum_kind = 'turnout_threshold'::text) AND (quorum_threshold IS NOT NULL) AND (quorum_threshold > (0)::numeric) AND (quorum_threshold <= (1)::numeric)) OR (quorum_kind <> 'turnout_threshold'::text)));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_no_meaning_check" CHECK ((length(TRIM(BOTH FROM no_meaning)) > 0));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_official_no_percent_check" CHECK (((official_no_percent IS NULL) OR ((official_no_percent >= (0)::numeric) AND (official_no_percent <= (100)::numeric))));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_official_turnout_percent_check" CHECK (((official_turnout_percent IS NULL) OR ((official_turnout_percent >= (0)::numeric) AND (official_turnout_percent <= (100)::numeric))));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_official_yes_percent_check" CHECK (((official_yes_percent IS NULL) OR ((official_yes_percent >= (0)::numeric) AND (official_yes_percent <= (100)::numeric))));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_question_text_check" CHECK ((length(TRIM(BOTH FROM question_text)) > 0));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_quorum_kind_check" CHECK ((quorum_kind = ANY (ARRAY['none'::text, 'turnout_threshold'::text, 'custom'::text])));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_source_id_check" CHECK ((length(TRIM(BOTH FROM source_id)) > 0));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_source_url_check" CHECK ((length(TRIM(BOTH FROM source_url)) > 0));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'postponed'::text, 'cancelled'::text, 'closed'::text])));
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_yes_meaning_check" CHECK ((length(TRIM(BOTH FROM yes_meaning)) > 0));
ALTER TABLE public."political_opinion_notifications" ADD CONSTRAINT "political_opinion_notifications_check" CHECK ((previous_value <> new_value));
ALTER TABLE public."political_opinion_notifications" ADD CONSTRAINT "political_opinion_notifications_new_value_check" CHECK ((new_value = ANY (ARRAY['f'::text, 'c'::text, 'i'::text])));
ALTER TABLE public."political_opinion_notifications" ADD CONSTRAINT "political_opinion_notifications_previous_value_check" CHECK ((previous_value = ANY (ARRAY['f'::text, 'c'::text, 'i'::text])));
ALTER TABLE public."civic_ballot_positions" ADD CONSTRAINT "civic_ballot_positions_civic_ballot_id_fkey" FOREIGN KEY (civic_ballot_id) REFERENCES civic_ballots(id) ON DELETE CASCADE;
ALTER TABLE public."civic_ballot_positions" ADD CONSTRAINT "civic_ballot_positions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."civic_ballots" ADD CONSTRAINT "civic_ballots_civic_process_id_fkey" FOREIGN KEY (civic_process_id) REFERENCES civic_processes(id) ON DELETE CASCADE;
ALTER TABLE public."notifiche_avvistamenti" ADD CONSTRAINT "notifiche_avvistamenti_id_utente_fkey" FOREIGN KEY (id_utente) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."notifiche_comunali" ADD CONSTRAINT "informa_cittadini_id_utente_fkey" FOREIGN KEY (id_utente) REFERENCES users(id);
ALTER TABLE public."notifiche_voti_comuni" ADD CONSTRAINT "comunicazioni_utente_id_fkey" FOREIGN KEY (id_utente) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."political_opinion_notifications" ADD CONSTRAINT "political_opinion_notifications_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."political_opinion_notifications" ADD CONSTRAINT "political_opinion_notifications_subject_user_id_fkey" FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_civic_ballot_positions_choice ON public.civic_ballot_positions USING btree (civic_ballot_id, choice);
CREATE INDEX idx_civic_ballot_positions_user ON public.civic_ballot_positions USING btree (user_id);
CREATE INDEX idx_civic_ballots_active ON public.civic_ballots USING btree (status, opens_at, closes_at);
CREATE INDEX idx_notifiche_avvistamenti_comune ON public.notifiche_avvistamenti USING btree (comune_residenza);
CREATE INDEX idx_notifiche_avvistamenti_data ON public.notifiche_avvistamenti USING btree (data DESC);
CREATE INDEX idx_notifiche_avvistamenti_utente ON public.notifiche_avvistamenti USING btree (id_utente);
CREATE INDEX idx_comunicazioni_utente ON public.notifiche_voti_comuni USING btree (id_utente);
CREATE INDEX idx_political_opinion_notifications_recipient_created ON public.political_opinion_notifications USING btree (recipient_user_id, created_at DESC);
CREATE INDEX idx_political_opinion_notifications_subject_created ON public.political_opinion_notifications USING btree (subject_user_id, created_at DESC);
CREATE INDEX idx_segnalazioni_data_creazione ON public.segnalazioni USING btree (data_creazione);
CREATE INDEX idx_segnalazioni_priorita ON public.segnalazioni USING btree (priorita);
CREATE INDEX idx_segnalazioni_status ON public.segnalazioni USING btree (status);
CREATE INDEX idx_segnalazioni_tipo ON public.segnalazioni USING btree (tipo);
CREATE INDEX idx_segnalazioni_utente_id ON public.segnalazioni USING btree (utente_id);
ALTER TABLE public."civic_ballots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."civic_ballot_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifiche_avvistamenti" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifiche_comunali" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifiche_voti_comuni" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."political_opinion_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."segnalazioni" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."civic_ballots", public."civic_ballot_positions", public."notifiche_avvistamenti", public."notifiche_comunali", public."notifiche_voti_comuni", public."political_opinion_notifications", public."segnalazioni" FROM PUBLIC, anon, authenticated;
COMMIT;
