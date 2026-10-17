-- DEMOS — scheda di voto per referendum realmente convocati.
-- Questa migrazione NON ripristina la vecchia classifica di priorità referendum.
-- Modella invece il quesito ufficiale e la scelta corrente YES / NO / ABSTAIN.

BEGIN;

CREATE TABLE IF NOT EXISTS civic_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  civic_process_id UUID NOT NULL UNIQUE REFERENCES civic_processes(id) ON DELETE CASCADE,
  ballot_kind TEXT NOT NULL,
  question_text TEXT NOT NULL,
  yes_meaning TEXT NOT NULL,
  no_meaning TEXT NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  quorum_kind TEXT NOT NULL DEFAULT 'none',
  quorum_threshold NUMERIC(7,6),
  status TEXT NOT NULL DEFAULT 'scheduled',
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  official_reference TEXT,
  official_turnout_percent NUMERIC(6,3),
  official_yes_percent NUMERIC(6,3),
  official_no_percent NUMERIC(6,3),
  official_result_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(ballot_kind)) > 0),
  CHECK (length(trim(question_text)) > 0),
  CHECK (length(trim(yes_meaning)) > 0),
  CHECK (length(trim(no_meaning)) > 0),
  CHECK (closes_at > opens_at),
  CHECK (quorum_kind IN ('none', 'turnout_threshold', 'custom')),
  CHECK (
    (quorum_kind = 'turnout_threshold' AND quorum_threshold IS NOT NULL AND quorum_threshold > 0 AND quorum_threshold <= 1)
    OR (quorum_kind <> 'turnout_threshold')
  ),
  CHECK (status IN ('scheduled', 'postponed', 'cancelled', 'closed')),
  CHECK (length(trim(source_id)) > 0),
  CHECK (length(trim(source_url)) > 0),
  CHECK (official_turnout_percent IS NULL OR (official_turnout_percent >= 0 AND official_turnout_percent <= 100)),
  CHECK (official_yes_percent IS NULL OR (official_yes_percent >= 0 AND official_yes_percent <= 100)),
  CHECK (official_no_percent IS NULL OR (official_no_percent >= 0 AND official_no_percent <= 100))
);

CREATE INDEX IF NOT EXISTS idx_civic_ballots_active
  ON civic_ballots(status, opens_at, closes_at);

CREATE TABLE IF NOT EXISTS civic_ballot_positions (
  civic_ballot_id UUID NOT NULL REFERENCES civic_ballots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (civic_ballot_id, user_id),
  CHECK (choice IN ('YES', 'NO', 'ABSTAIN'))
);

CREATE INDEX IF NOT EXISTS idx_civic_ballot_positions_user
  ON civic_ballot_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_civic_ballot_positions_choice
  ON civic_ballot_positions(civic_ballot_id, choice);

-- Tabelle interne al backend: ogni accesso passa dalle route DEMOS.
ALTER TABLE civic_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_ballot_positions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE civic_ballots IS
  'Referendum ufficialmente convocati sui quali DEMOS raccoglie una previsione Sì/No/Non voterei.';
COMMENT ON TABLE civic_ballot_positions IS
  'Scelta politica corrente per quesito; nessuno storico individuale delle modifiche.';

COMMIT;
