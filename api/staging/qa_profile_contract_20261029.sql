-- DEMOS staging ONLY: schema-only contract snapshot, generated 2026-10-29.

-- Generated from production PostgreSQL catalog metadata (column names/types/defaults/constraints),

-- not from production user data. Do not run against DEMOS production.

-- All tables reside in an isolated, non-Data-API-exposed QA schema.

-- This is not a complete runnable DEMOS staging app or a replacement for #382.

CREATE SCHEMA IF NOT EXISTS "qa_profile_contract_20261029";

REVOKE ALL ON SCHEMA "qa_profile_contract_20261029" FROM PUBLIC;

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" character varying(255),
  "created_at" timestamp with time zone DEFAULT now(),
  "ruolo" character varying(50) DEFAULT 'E'::character varying,
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "nome" text,
  "cognome" text,
  "avatar_config" text,
  "data_nascita" date,
  "genere" character varying(20),
  "cittadinanza" character varying(100),
  "paese_residenza" character varying(100),
  "regione_residenza" character varying(100),
  "provincia_residenza" character varying(100),
  "comune_residenza" character varying(100),
  "paese_elezione" character varying(100),
  "regione_elezione" character varying(100),
  "provincia_elezione" character varying(100),
  "comune_elezione" character varying(100),
  "grado_elezione" character varying(100),
  "paese_candidatura" character varying(100),
  "regione_candidatura" character varying(100),
  "provincia_candidatura" character varying(100),
  "comune_candidatura" character varying(100),
  "grado_candidatura" character varying(100),
  "notifiche_preferenze" jsonb DEFAULT '{}'::jsonb,
  "premium" boolean DEFAULT false,
  "firestore_uid" text,
  "rappresentante_europeo" text,
  "rappresentante_camera" text,
  "rappresentante_senato" text,
  "rappresentante_regionale" text,
  "rappresentante_comune" text,
  "candidato_europeo" text,
  "candidato_camera" text,
  "candidato_senato" text,
  "candidato_regionale" text,
  "candidato_comune" text,
  "reset_token" text,
  "reset_token_expires" timestamp without time zone,
  "email_verification_token" text,
  "candidato_attivo" boolean,
  "status_candidatura" character varying(50),
  "data_candidatura" date,
  "note_candidatura" text,
  "updated_at" timestamp with time zone DEFAULT now(),
  "privacy_policy_consent" boolean DEFAULT false,
  "terms_of_service_consent" boolean DEFAULT false,
  "consent_timestamp" timestamp with time zone,
  "consent_ip_address" character varying(45),
  "consent_user_agent" text,
  "profile_visibility" boolean DEFAULT true,
  "opinions_public" boolean DEFAULT false,
  "email_notifications" boolean DEFAULT true,
  "push_notifications" boolean DEFAULT true,
  "data_analytics" boolean DEFAULT true,
  "marketing_emails" boolean DEFAULT false,
  "auth_method" character varying(20) DEFAULT 'credentials'::character varying,
  "verified" boolean DEFAULT false,
  "sesso" character varying(1),
  "luogo_nascita" character varying(100),
  "is_admin" boolean DEFAULT false NOT NULL,
  "is_premium" boolean DEFAULT false,
  "facebook_url" character varying(255),
  "twitter_url" character varying(255),
  "instagram_url" character varying(255),
  "linkedin_url" character varying(255),
  "telegram_url" character varying(255),
  "website_url" character varying(255),
  "twitch_url" character varying(255),
  "youtube_url" character varying(255),
  "tipologie_attivismo" jsonb DEFAULT '[]'::jsonb,
  "attivisti" uuid,
  "organizzazioni" uuid,
  "fiscal_number" character varying(20),
  "political_opinions_consent" boolean DEFAULT false,
  "political_opinions_consent_timestamp" timestamp with time zone,
  "political_opinions_consent_ip_address" character varying(45),
  "political_opinions_consent_user_agent" text,
  "fcm_tokens" text[] DEFAULT ARRAY[]::text[],
  "opinione_proposta_id" text,
  "webauthn_user_handle" text,
  "webauthn_credential_id" text,
  "webauthn_public_key" text,
  "webauthn_sign_count" integer,
  "webauthn_device_id" text,
  "google_sub" text,
  "apple_user_id" text,
  "email" character varying(255),
  "account_type" character varying(20) DEFAULT 'PERSON'::character varying NOT NULL,
  "is_activist" boolean DEFAULT false NOT NULL,
  "is_dpo" boolean DEFAULT false NOT NULL,
  CHECK ((NOT ((is_admin IS TRUE) AND (is_dpo IS TRUE)))),
  CHECK (((account_type)::text = ANY ((ARRAY['PERSON'::character varying, 'INSTITUTION'::character varying, 'ORGANIZATION'::character varying])::text[]))),
  PRIMARY KEY (id),
  UNIQUE (firestore_uid),
  UNIQUE (fiscal_number)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."user_profile" (
  "user_id" uuid NOT NULL,
  "genere" text,
  "data_nascita" date,
  "cittadinanza" text,
  "paese_residenza" text,
  "regione_residenza" text,
  "provincia_residenza" text,
  "comune_residenza" text,
  "grado_elezione" text,
  "paese_elezione" text,
  "regione_elezione" text,
  "provincia_elezione" text,
  "comune_elezione" text,
  "grado_candidatura" text,
  "paese_candidatura" text,
  "regione_candidatura" text,
  "provincia_candidatura" text,
  "comune_candidatura" text,
  "facebook_url" text,
  "twitter_url" text,
  "instagram_url" text,
  "linkedin_url" text,
  "telegram_url" text,
  "website_url" text,
  "twitch_url" text,
  "youtube_url" text,
  "avatar_config" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."user_consents" (
  "user_id" uuid NOT NULL,
  "privacy_policy_consent" boolean,
  "terms_of_service_consent" boolean,
  "consent_timestamp" timestamp with time zone,
  "political_opinions_consent" boolean,
  "political_opinions_consent_timestamp" timestamp with time zone,
  "political_opinions_consent_ip_address" text,
  "political_opinions_consent_user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."user_representatives" (
  "user_id" uuid NOT NULL,
  "rappresentante_europeo" text,
  "rappresentante_camera" text,
  "rappresentante_senato" text,
  "rappresentante_regionale" text,
  "rappresentante_comune" text,
  "candidato_europeo" text,
  "candidato_camera" text,
  "candidato_senato" text,
  "candidato_regionale" text,
  "candidato_comune" text,
  "attivisti" text,
  "organizzazioni" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."opinioni_domande" (
  "id" character varying NOT NULL,
  "text" text NOT NULL,
  "gradi_opinione" text[] NOT NULL,
  "approfondimento" text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."opinioni_risposte" (
  "user_id" uuid NOT NULL,
  "energia_nucleare" text,
  "sperimentazione_animale" text,
  "legalizzazione_canapa" text,
  "caccia" text,
  "eutanasia" text,
  "carne_coltivata" text,
  "nato" text,
  "matrimonio_gay" text,
  "salario_minimo" text,
  "case_chiuse" text,
  "omobitransfobia" text,
  "cassonetti_intelligenti_con_tessera" text,
  "concessione_spazi_pubblici_a_centri_sociali_autogestiti" text,
  "divieto_di_nuovi_fast_food_nel_centro_storico" text,
  "estensione_delle_zone_a_traffico_limitato" text,
  "finanziamento_eventi_culturali_gratuiti" text,
  "nuova_biblioteca_comunale" text,
  "nuove_case_popolari" text,
  "nuove_piste_ciclabili" text,
  "nuovi_asili_nido_comunali" text,
  "nuovo_stadio_comunale" text,
  "parcheggi_gratuiti_per_residenti" text,
  "potenziamento_trasporto_pubblico" text,
  "riduzione_tasse_rifiuti" text,
  "sicurezza_strade_scolastiche" text,
  "sostegno_commercio_locale" text,
  "verde_pubblico_e_giardini" text,
  "nuovi_inceneritori" text,
  "chiusura_ospedali_di_provincia" text,
  "raccolta_rifiuti_porta_a_porta" text,
  "riduzione_dell_illuminazione_notturna_per_risparmio_energetico" text,
  "sussidi_comunali_per_famiglie_numerose" text,
  "videosorveglianza_in_spazi_pubblici" text,
  "riduzione_parcheggi_a_pagamento" text,
  "fonti_opinioni" jsonb,
  "corrida" text,
  "esercito_europeo" text,
  "ius_soli" text,
  "leva_obbligatoria" text,
  "potenziare_rinnovabili" text,
  "multe_in_base_al_reddito" text,
  "test_antidroga_per_politici" text,
  "test_psichiatrico_per_politici" text,
  "fuochi_d_artificio" text,
  "rilascio_di_palloncini" text,
  "sionismo" text,
  "antifascismo" text,
  "abolizione_contante" text,
  "metabo_law" text,
  "ponte_sullo_stretto" text,
  "abbattimento_cinghiali" text,
  "abolizione_ticket_regionali" text,
  "aborto_farmacologico_consultori" text,
  "adozioni_omogenitoriali" text,
  "armi_ucraina" text,
  "asili_nido_gratuiti" text,
  "auto_emissioni_zero_2035" text,
  "centri_comunali_accoglienza_migranti" text,
  "centri_migranti_estero" text,
  "citta_30" text,
  "educazione_sessuale" text,
  "finanziamento_rsa_private" text,
  "finanziamento_scuole_paritarie" text,
  "gare_concessioni_balneari" text,
  "gare_treni_regionali" text,
  "gestazione_per_altri" text,
  "imposta_di_soggiorno" text,
  "incentivi_regionali_auto_elettriche" text,
  "ius_scholae" text,
  "limitazioni_affitti_brevi" text,
  "limitazioni_movida_notturna" text,
  "menu_vegetali_mense_scolastiche" text,
  "nuove_aree_naturali_protette" text,
  "nuove_centrali_geotermiche" text,
  "nuove_discariche" text,
  "nuovi_parchi_eolici" text,
  "patrimoniale" text,
  "pedaggio_urbano" text,
  "pedonalizzazione_centro_storico" text,
  "polizia_locale_armata" text,
  "premio_maggioranza" text,
  "reddito_minimo_regionale" text,
  "restrizioni_sale_gioco" text,
  "riconoscimento_palestina" text,
  "sanita_privata_convenzionata" text,
  "settimana_lavorativa_32_ore" text,
  "spese_nato_5_percento" text,
  "tariffazione_puntuale_rifiuti" text,
  "trasporto_pubblico_gratuito" text,
  "treni_regionali_gratuiti" text,
  "autonomia_differenziata" text,
  "mes" text,
  "premierato" text,
  "reddito_di_cittadinanza" text,
  "allevamenti_intensivi" text,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."political_mandates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "election_event_id" uuid,
  "office_code" text,
  "institution_code" text,
  "jurisdiction" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "source" character varying(30) DEFAULT 'DEMOS'::character varying NOT NULL,
  "legacy_context" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CHECK (((ends_at IS NULL) OR (ends_at >= starts_at))),
  CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ENDED'::character varying, 'CANCELLED'::character varying])::text[]))),
  FOREIGN KEY (user_id) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."political_selections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "selection_kind" text NOT NULL,
  "jurisdiction_id" text NOT NULL,
  "political_office_id" text NOT NULL,
  "selected_user_id" uuid NOT NULL,
  "selected_candidacy_id" uuid,
  "selected_mandate_id" uuid,
  "source" text DEFAULT 'matching'::text NOT NULL,
  "context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CHECK ((((selection_kind = 'candidate'::text) AND (selected_mandate_id IS NULL)) OR ((selection_kind = 'representative'::text) AND (selected_candidacy_id IS NULL)))),
  CHECK ((selection_kind = ANY (ARRAY['candidate'::text, 'representative'::text]))),
  FOREIGN KEY (selected_user_id) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."voti_ministri" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "userid" uuid NOT NULL,
  "firestore_uid_backup" text NOT NULL,
  "nome_ministro" text NOT NULL,
  "nome_display" text NOT NULL,
  "categoria" text NOT NULL,
  "timestamp" timestamp without time zone DEFAULT now(),
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  FOREIGN KEY (userid) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  PRIMARY KEY (id),
  UNIQUE (userid, nome_ministro)
);

CREATE TABLE IF NOT EXISTS "qa_profile_contract_20261029"."voti_primo_ministro" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "userid" uuid NOT NULL,
  "nome_ministro" character varying(255) NOT NULL,
  "nome_display" character varying(255) NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  FOREIGN KEY (userid) REFERENCES "qa_profile_contract_20261029"."users"(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);


-- Fictional identities: example.invalid email domains and fixed UUIDs; no real people.

INSERT INTO qa_profile_contract_20261029.users
(id,nome,cognome,email,ruolo,status,data_nascita,cittadinanza,paese_residenza,regione_residenza,provincia_residenza,comune_residenza,political_opinions_consent,political_opinions_consent_timestamp)
VALUES
('00000000-0000-4000-8000-000000000101','Profilo','Fittizio','qa-profile-1@example.invalid','E','A','1990-01-01','Italiana','Italia','Toscana','Pisa','Comune Fittizio',true,now()),
('00000000-0000-4000-8000-000000000102','Politico','Fittizio','qa-profile-2@example.invalid','P','A','1988-01-01','Italiana','Italia','Toscana','Pisa','Comune Fittizio',false,null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO qa_profile_contract_20261029.user_profile
(user_id,data_nascita,cittadinanza,paese_residenza,regione_residenza,provincia_residenza,comune_residenza)
VALUES
('00000000-0000-4000-8000-000000000101','1990-01-01','Italiana','Italia','Toscana','Pisa','Comune Fittizio'),
('00000000-0000-4000-8000-000000000102','1988-01-01','Italiana','Italia','Toscana','Pisa','Comune Fittizio')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO qa_profile_contract_20261029.user_consents (user_id,political_opinions_consent,political_opinions_consent_timestamp)
VALUES ('00000000-0000-4000-8000-000000000101',true,now()),('00000000-0000-4000-8000-000000000102',false,null)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO qa_profile_contract_20261029.user_representatives (user_id,rappresentante_camera)
VALUES ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO qa_profile_contract_20261029.opinioni_domande(id,text,gradi_opinione) VALUES ('qa_synthetic_opinion','Domanda inventata per test tecnico',ARRAY['N']::text[]) ON CONFLICT (id) DO NOTHING;

INSERT INTO qa_profile_contract_20261029.opinioni_risposte(user_id,energia_nucleare)
VALUES ('00000000-0000-4000-8000-000000000101','f') ON CONFLICT (user_id) DO NOTHING;

INSERT INTO qa_profile_contract_20261029.political_mandates(user_id,office_code,institution_code)
SELECT '00000000-0000-4000-8000-000000000102','NATIONAL_DEPUTY','SYNTHETIC_CHAMBER'
WHERE NOT EXISTS (
 SELECT 1 FROM qa_profile_contract_20261029.political_mandates WHERE user_id='00000000-0000-4000-8000-000000000102' AND office_code='NATIONAL_DEPUTY'
);

-- All QA tables must stay invisible to anon/authenticated Data API roles.

-- Do not GRANT USAGE on qa_profile_contract_20261029 to anon or authenticated.
