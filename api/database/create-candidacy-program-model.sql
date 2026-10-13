BEGIN;

CREATE TABLE IF NOT EXISTS political_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidacy_id UUID NOT NULL UNIQUE REFERENCES political_candidacies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content JSONB NOT NULL DEFAULT '{"proposals":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_political_programs_user
  ON political_programs(user_id);

CREATE TABLE IF NOT EXISTS mandate_program_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL UNIQUE REFERENCES political_mandates(id) ON DELETE CASCADE,
  candidacy_id UUID NOT NULL,
  user_id UUID NOT NULL,
  election_event_id UUID NULL,
  content JSONB NOT NULL,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mandate_program_snapshots_user
  ON mandate_program_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_mandate_program_snapshots_election
  ON mandate_program_snapshots(election_event_id)
  WHERE election_event_id IS NOT NULL;

-- Backfill only when the legacy user-scoped program maps unambiguously to exactly
-- one active candidacy. Ambiguous multi-candidacy cases require explicit assignment.
INSERT INTO political_programs (candidacy_id, user_id, content)
SELECT
  pc.id,
  p.utente_id,
  jsonb_build_object(
    'proposals', jsonb_build_array(
      jsonb_build_object('text', COALESCE(p.proposta_1, ''), 'url', COALESCE(p.url_1, '')),
      jsonb_build_object('text', COALESCE(p.proposta_2, ''), 'url', COALESCE(p.url_2, '')),
      jsonb_build_object('text', COALESCE(p.proposta_3, ''), 'url', COALESCE(p.url_3, '')),
      jsonb_build_object('text', COALESCE(p.proposta_4, ''), 'url', COALESCE(p.url_4, '')),
      jsonb_build_object('text', COALESCE(p.proposta_5, ''), 'url', COALESCE(p.url_5, ''))
    )
  )
FROM programmi p
JOIN political_candidacies pc
  ON pc.user_id = p.utente_id
 AND pc.status = 'ACTIVE'
WHERE (
  SELECT COUNT(*)
  FROM political_candidacies pc2
  WHERE pc2.user_id = p.utente_id AND pc2.status = 'ACTIVE'
) = 1
ON CONFLICT (candidacy_id) DO NOTHING;

COMMIT;
