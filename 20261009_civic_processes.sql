BEGIN;

-- IMP-029: persistenza canonica multi-fonte dei processi civici.
-- Modello volutamente jurisdiction-neutral: nessuna colonna Camera/Senato/Italia-specifica.
CREATE TABLE IF NOT EXISTS civic_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id TEXT NOT NULL,
  process_type_id TEXT NOT NULL,
  canonical_title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  canonical_stage TEXT,
  canonical_url TEXT,
  official_reference TEXT,
  first_official_date DATE,
  latest_official_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(jurisdiction_id)) > 0),
  CHECK (length(trim(process_type_id)) > 0),
  CHECK (length(trim(canonical_title)) > 0),
  CHECK (length(trim(normalized_title)) > 0)
);

-- Esito sostanziale verificato manualmente dallo Staff DEMOS. È separato dallo stage
-- parlamentare: una pratica può restare prioritaria anche dopo rigetto/decadenza.
ALTER TABLE civic_processes
  ADD COLUMN IF NOT EXISTS realized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS realized_law_reference TEXT,
  ADD COLUMN IF NOT EXISTS realized_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS realized_verified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE civic_processes DROP CONSTRAINT IF EXISTS chk_civic_process_realization_reference;
ALTER TABLE civic_processes ADD CONSTRAINT chk_civic_process_realization_reference
  CHECK (NOT realized OR (realized_law_reference IS NOT NULL AND length(trim(realized_law_reference)) > 0));

CREATE INDEX IF NOT EXISTS idx_civic_processes_jurisdiction_type_stage
  ON civic_processes (jurisdiction_id, process_type_id, canonical_stage);

CREATE INDEX IF NOT EXISTS idx_civic_processes_normalized_title
  ON civic_processes (jurisdiction_id, process_type_id, normalized_title);

CREATE UNIQUE INDEX IF NOT EXISTS uq_civic_processes_official_reference
  ON civic_processes (jurisdiction_id, process_type_id, official_reference)
  WHERE official_reference IS NOT NULL;

-- Identificatori istituzionali forti, molti-per-processo. Consentono di collegare
-- la stessa iniziativa tra fonti diverse senza affidarsi a confronti fuzzy del titolo.
CREATE TABLE IF NOT EXISTS civic_process_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  civic_process_id UUID NOT NULL REFERENCES civic_processes(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  value TEXT NOT NULL,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(namespace)) > 0),
  CHECK (length(trim(value)) > 0),
  UNIQUE (namespace, value)
);

CREATE INDEX IF NOT EXISTS idx_civic_process_identifiers_process
  ON civic_process_identifiers (civic_process_id);

CREATE TABLE IF NOT EXISTS civic_process_source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  civic_process_id UUID NOT NULL REFERENCES civic_processes(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  source_uri TEXT,
  source_url TEXT,
  source_title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  source_stage TEXT,
  source_status TEXT,
  official_reference TEXT,
  presented_at DATE,
  status_updated_at DATE,
  payload_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reconciliation_method TEXT NOT NULL DEFAULT 'source_identity',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(source_id)) > 0),
  CHECK (length(trim(external_id)) > 0),
  CHECK (length(trim(source_title)) > 0),
  CHECK (length(trim(normalized_title)) > 0),
  CHECK (reconciliation_method IN ('source_identity', 'official_reference', 'explicit_review')),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_civic_process_source_records_process
  ON civic_process_source_records (civic_process_id, source_id);

CREATE INDEX IF NOT EXISTS idx_civic_process_source_records_reference
  ON civic_process_source_records (official_reference)
  WHERE official_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_civic_process_source_records_title_candidate
  ON civic_process_source_records (normalized_title, source_id);

-- Non effettua merge automatici. Conserva soltanto candidati da sottoporre a
-- riconciliazione esplicita quando manca un identificatore istituzionale comune.
CREATE TABLE IF NOT EXISTS civic_process_reconciliation_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id UUID NOT NULL REFERENCES civic_process_source_records(id) ON DELETE CASCADE,
  candidate_process_id UUID NOT NULL REFERENCES civic_processes(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'accepted', 'rejected')),
  UNIQUE (source_record_id, candidate_process_id)
);

CREATE INDEX IF NOT EXISTS idx_civic_process_reconciliation_pending
  ON civic_process_reconciliation_candidates (status, created_at)
  WHERE status = 'pending';

-- Tabelle interne al backend: nessun accesso diretto anon/authenticated dalla Data API.
-- Il backend usa la connessione PostgreSQL server-side; eventuali superfici pubbliche
-- devono passare dalle route DEMOS che applicano policy e proiezioni esplicite.
ALTER TABLE civic_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_process_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_process_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_process_reconciliation_candidates ENABLE ROW LEVEL SECURITY;

COMMIT;
