-- DEMOS Institutional Territorial Notices v1
-- Canonical, backend-only municipal notices. Legacy notifiche_comunali rows are not
-- migrated because their target municipality was historically derived from free text.

BEGIN;

CREATE TABLE IF NOT EXISTS institutional_territorial_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipologia TEXT NOT NULL,
  dove TEXT NOT NULL,
  dal_giorno DATE NOT NULL,
  al_giorno DATE NOT NULL,
  jurisdiction_id TEXT NOT NULL,
  territory_type TEXT NOT NULL,
  territory_code TEXT NOT NULL,
  territory_label TEXT,
  authority_source TEXT NOT NULL,
  authority_verification_level TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(tipologia) <> ''),
  CHECK (BTRIM(dove) <> ''),
  CHECK (al_giorno >= dal_giorno),
  CHECK (territory_type = 'MUNICIPALITY'),
  CHECK (BTRIM(territory_code) <> ''),
  CHECK (authority_verification_level = 'OFFICIAL')
);

CREATE INDEX IF NOT EXISTS idx_institutional_territorial_notices_target_created
  ON institutional_territorial_notices(
    jurisdiction_id, territory_type, territory_code, created_at DESC
  );

ALTER TABLE institutional_territorial_notices ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated Data API policies: reads and writes go through the backend.

COMMIT;
