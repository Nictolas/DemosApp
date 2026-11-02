-- OPS-STG-001: additive schema for the existing Demos-Staging Supabase project only.
-- No production data, backfill, copy, drop, truncate or external calls.
-- Project ref MUST be verified externally before execution: fkeayjzvtuvzesljhjbc.
-- DO NOT RUN during shared staging bootstrap. An explicit operator GO is
-- required after consolidation; database identity hash is checked in addition to external project selection.
-- Run as a single atomic transaction, so an error cannot leave a partial schema.
BEGIN;
DO $$
BEGIN
  -- Both production and staging now have civic_runtime_identity.
  -- The identity hash is specific to Demos-Staging; absence or mismatch fails closed.
  IF (SELECT count(*) FROM public.civic_runtime_identity WHERE id = 1
      AND md5(db_identity::text) = '0cbb6ace68a9f11956904e2a37898ec8') != 1 THEN
    RAISE EXCEPTION 'STOP: database identity is not Demos-Staging';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'STOP: existing staging users table is absent';
  END IF;
  IF to_regclass('public.eventi') IS NOT NULL OR
     to_regclass('public.programmi') IS NOT NULL OR
     to_regclass('public.civic_processes') IS NOT NULL OR
     to_regclass('public.civic_process_identifiers') IS NOT NULL OR
     to_regclass('public.civic_process_source_records') IS NOT NULL OR
     to_regclass('public.civic_process_reconciliation_candidates') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: at least one target table already exists; reconcile before retry';
  END IF;
END;
$$;

CREATE TABLE public.eventi (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome_evento varchar(255) NOT NULL,
 tipologia_evento varchar(100) NOT NULL,
 paese_evento varchar(100),
 regione_evento varchar(100),
 provincia_evento varchar(100),
 comune_evento varchar(100),
 indirizzo_evento text,
 orario_evento time,
 inizio_evento timestamp,
 fine_evento timestamp,
 created_at timestamp DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
 organizzatore varchar(255),
 giorno_inizio date,
 giorno_fine date,
 orario_inizio time,
 orario_fine time,
 tipo_elezione varchar(50),
 orario_inizio_giorno2 time,
 orario_fine_giorno2 time,
 creator_user_id uuid,
 approval_status varchar(20) NOT NULL DEFAULT 'PENDING',
 approval_requested_at timestamptz,
 approved_at timestamptz,
 approved_by_user_id uuid,
 rejection_reason text,
 election_lifecycle_closed_at timestamptz,
 election_lifecycle_closed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 CONSTRAINT eventi_approval_status_check CHECK (approval_status IN ('PENDING','APPROVED','REJECTED'))
);
CREATE INDEX idx_eventi_approval_status_date ON public.eventi (approval_status, giorno_inizio);
CREATE INDEX idx_eventi_comune ON public.eventi (comune_evento);
CREATE INDEX idx_eventi_creator_user ON public.eventi (creator_user_id) WHERE creator_user_id IS NOT NULL;
CREATE INDEX idx_eventi_election_lifecycle_open ON public.eventi (COALESCE(giorno_fine, giorno_inizio))
 WHERE (lower(trim(tipologia_evento)) = 'elezioni' AND election_lifecycle_closed_at IS NULL);
CREATE INDEX idx_eventi_fine ON public.eventi (fine_evento);
CREATE INDEX idx_eventi_inizio ON public.eventi (inizio_evento);
CREATE INDEX idx_eventi_lifecycle_closed_by_user ON public.eventi (election_lifecycle_closed_by_user_id) WHERE election_lifecycle_closed_by_user_id IS NOT NULL;
CREATE INDEX idx_eventi_provincia ON public.eventi (provincia_evento);
CREATE INDEX idx_eventi_regione ON public.eventi (regione_evento);
CREATE INDEX idx_eventi_tipologia ON public.eventi (tipologia_evento);

CREATE TABLE public.programmi (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 firestore_id_backup text UNIQUE,
 user_id_backup uuid REFERENCES public.users(id) ON DELETE SET NULL,
 firestore_uid_backup text,
 nome text,
 descrizione text,
 partito text,
 created_at timestamp DEFAULT now(),
 updated_at timestamp DEFAULT now(),
 proposta_1 text,
 proposta_2 text,
 proposta_3 text,
 proposta_4 text,
 proposta_5 text,
 utente_id uuid UNIQUE REFERENCES public.users(id),
 url_1 text,
 url_2 text,
 url_3 text,
 url_4 text,
 url_5 text
);

CREATE TABLE public.civic_processes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 jurisdiction_id text NOT NULL CHECK (length(trim(jurisdiction_id)) > 0),
 process_type_id text NOT NULL CHECK (length(trim(process_type_id)) > 0),
 canonical_title text NOT NULL CHECK (length(trim(canonical_title)) > 0),
 normalized_title text NOT NULL CHECK (length(trim(normalized_title)) > 0),
 canonical_stage text,
 canonical_url text,
 official_reference text,
 first_official_date date,
 latest_official_date date,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 realized boolean NOT NULL DEFAULT false,
 realized_law_reference text,
 realized_verified_at timestamptz,
 realized_verified_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 CONSTRAINT chk_civic_process_realization_reference CHECK (NOT realized OR (realized_law_reference IS NOT NULL AND length(trim(realized_law_reference)) > 0))
);
CREATE INDEX idx_civic_processes_jurisdiction_type_stage ON public.civic_processes (jurisdiction_id, process_type_id, canonical_stage);
CREATE INDEX idx_civic_processes_normalized_title ON public.civic_processes (jurisdiction_id, process_type_id, normalized_title);
CREATE INDEX idx_civic_processes_realized_verified_by ON public.civic_processes (realized_verified_by_user_id) WHERE realized_verified_by_user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_civic_processes_official_reference ON public.civic_processes (jurisdiction_id, process_type_id, official_reference) WHERE official_reference IS NOT NULL;

CREATE TABLE public.civic_process_identifiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 civic_process_id uuid NOT NULL REFERENCES public.civic_processes(id) ON DELETE CASCADE,
 namespace text NOT NULL CHECK (length(trim(namespace)) > 0),
 value text NOT NULL CHECK (length(trim(value)) > 0),
 source_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (namespace, value)
);
CREATE INDEX idx_civic_process_identifiers_process ON public.civic_process_identifiers (civic_process_id);

CREATE TABLE public.civic_process_source_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 civic_process_id uuid NOT NULL REFERENCES public.civic_processes(id) ON DELETE CASCADE,
 source_id text NOT NULL CHECK (length(trim(source_id)) > 0),
 external_id text NOT NULL CHECK (length(trim(external_id)) > 0),
 source_uri text,
 source_url text,
 source_title text NOT NULL CHECK (length(trim(source_title)) > 0),
 normalized_title text NOT NULL CHECK (length(trim(normalized_title)) > 0),
 source_stage text,
 source_status text,
 official_reference text,
 presented_at date,
 status_updated_at date,
 payload_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 reconciliation_method text NOT NULL DEFAULT 'source_identity' CHECK (reconciliation_method IN ('source_identity','official_reference','explicit_review')),
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (source_id, external_id)
);
CREATE INDEX idx_civic_process_source_records_process ON public.civic_process_source_records (civic_process_id, source_id);
CREATE INDEX idx_civic_process_source_records_reference ON public.civic_process_source_records (official_reference) WHERE official_reference IS NOT NULL;
CREATE INDEX idx_civic_process_source_records_title_candidate ON public.civic_process_source_records (normalized_title, source_id);

CREATE TABLE public.civic_process_reconciliation_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_record_id uuid NOT NULL REFERENCES public.civic_process_source_records(id) ON DELETE CASCADE,
 candidate_process_id uuid NOT NULL REFERENCES public.civic_processes(id) ON DELETE CASCADE,
 reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
 reviewed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (source_record_id, candidate_process_id)
);
CREATE INDEX idx_civic_process_reconciliation_pending ON public.civic_process_reconciliation_candidates (status, created_at) WHERE status = 'pending';

-- Supabase public schema may be exposed by the Data API. These staging-only tables
-- are internal, so no direct anon/authenticated access is authorized.
ALTER TABLE public.eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civic_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civic_process_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civic_process_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civic_process_reconciliation_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eventi, public.programmi, public.civic_processes,
 public.civic_process_identifiers, public.civic_process_source_records,
 public.civic_process_reconciliation_candidates FROM PUBLIC, anon, authenticated;

-- Commit only when ALL tables, indexes, row security and grants succeed.
COMMIT;
