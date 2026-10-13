-- DEMOS Political Selections v1
-- Canonical, jurisdiction-aware persistence for current representative/candidate choices.
-- Additive migration: legacy users.* and user_representatives columns remain compatibility projections.

BEGIN;

CREATE TABLE IF NOT EXISTS political_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selection_kind TEXT NOT NULL,
  jurisdiction_id TEXT NOT NULL,
  political_office_id TEXT NOT NULL,
  selected_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_candidacy_id UUID NULL,
  selected_mandate_id UUID NULL,
  source TEXT NOT NULL DEFAULT 'matching',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT political_selections_kind_check
    CHECK (selection_kind IN ('candidate', 'representative')),
  CONSTRAINT political_selections_target_relation_check
    CHECK (
      (selection_kind = 'candidate' AND selected_mandate_id IS NULL)
      OR
      (selection_kind = 'representative' AND selected_candidacy_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_political_selections_user_kind_office
  ON political_selections(user_id, selection_kind, political_office_id);

CREATE INDEX IF NOT EXISTS idx_political_selections_selected_subject
  ON political_selections(selected_user_id, selection_kind, political_office_id);

CREATE INDEX IF NOT EXISTS idx_political_selections_jurisdiction_office
  ON political_selections(jurisdiction_id, political_office_id);

-- Private preference data. Backend service-role access remains available;
-- no direct anon/authenticated Data API policy is created.
ALTER TABLE political_selections ENABLE ROW LEVEL SECURITY;

-- Backfill the current Italian compatibility projection.
-- selected_user is joined explicitly so malformed/stale legacy IDs are skipped.
INSERT INTO political_selections (
  user_id, selection_kind, jurisdiction_id, political_office_id, selected_user_id, source, context
)
SELECT
  u.id,
  valueset.selection_kind,
  valueset.jurisdiction_id,
  valueset.political_office_id,
  selected.id,
  'legacy_backfill',
  jsonb_build_object('legacy_field', valueset.legacy_field)
FROM users u
CROSS JOIN LATERAL (
  VALUES
    ('representative', 'eu', 'eu.parliament.it', 'rappresentante_europeo', u.rappresentante_europeo::text),
    ('representative', 'it', 'it.camera', 'rappresentante_camera', u.rappresentante_camera::text),
    ('representative', 'it', 'it.senato', 'rappresentante_senato', u.rappresentante_senato::text),
    ('representative', 'it', 'it.regional', 'rappresentante_regionale', u.rappresentante_regionale::text),
    ('representative', 'it', 'it.municipal', 'rappresentante_comune', u.rappresentante_comune::text),
    ('candidate', 'eu', 'eu.parliament.it', 'candidato_europeo', u.candidato_europeo::text),
    ('candidate', 'it', 'it.camera', 'candidato_camera', u.candidato_camera::text),
    ('candidate', 'it', 'it.senato', 'candidato_senato', u.candidato_senato::text),
    ('candidate', 'it', 'it.regional', 'candidato_regionale', u.candidato_regionale::text),
    ('candidate', 'it', 'it.municipal', 'candidato_comune', u.candidato_comune::text)
) AS valueset(selection_kind, jurisdiction_id, political_office_id, legacy_field, selected_user_text)
JOIN users selected ON selected.id::text = valueset.selected_user_text
WHERE NULLIF(BTRIM(valueset.selected_user_text), '') IS NOT NULL
ON CONFLICT (user_id, selection_kind, political_office_id)
DO UPDATE SET
  selected_user_id = EXCLUDED.selected_user_id,
  jurisdiction_id = EXCLUDED.jurisdiction_id,
  source = EXCLUDED.source,
  context = EXCLUDED.context,
  updated_at = NOW();

COMMIT;
