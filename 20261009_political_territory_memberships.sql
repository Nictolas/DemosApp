-- DEMOS Political Territory Memberships v1
-- Canonical geography + election-unit membership for a global political core.
-- Additive: legacy users.paese/regione/provincia/comune_residenza remain compatibility fields.

BEGIN;

CREATE TABLE IF NOT EXISTS user_political_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jurisdiction_id TEXT NOT NULL,
  territory_type TEXT NOT NULL,
  territory_code TEXT NOT NULL,
  political_office_id TEXT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  verification_level TEXT NOT NULL DEFAULT 'SELF_DECLARED',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (verification_level IN ('SELF_DECLARED','VERIFIED','OFFICIAL')),
  CHECK (territory_type IN (
    'SUPRANATIONAL','COUNTRY','ADMIN_LEVEL_1','ADMIN_LEVEL_2',
    'REGION','PROVINCE','MUNICIPALITY','ELECTORAL_DISTRICT'
  )),
  CHECK (BTRIM(territory_code) <> ''),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

DROP INDEX IF EXISTS uq_user_political_territories_active;
CREATE UNIQUE INDEX uq_user_political_territories_active
  ON user_political_territories(
    user_id, jurisdiction_id, territory_type, territory_code,
    COALESCE(political_office_id, ''), source
  )
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_political_territories_lookup
  ON user_political_territories(user_id, territory_type, political_office_id)
  WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS user_electoral_unit_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  election_event_id UUID NOT NULL,
  electoral_unit_id UUID NOT NULL,
  political_office_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  verification_level TEXT NOT NULL DEFAULT 'VERIFIED',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(political_office_id) <> ''),
  CHECK (verification_level IN ('SELF_DECLARED','VERIFIED','OFFICIAL')),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

DROP INDEX IF EXISTS uq_user_electoral_unit_memberships_active;
CREATE UNIQUE INDEX uq_user_electoral_unit_memberships_active
  ON user_electoral_unit_memberships(
    user_id, election_event_id, electoral_unit_id, political_office_id, source
  )
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_electoral_unit_memberships_event
  ON user_electoral_unit_memberships(user_id, election_event_id, political_office_id)
  WHERE valid_to IS NULL;

ALTER TABLE user_political_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_electoral_unit_memberships ENABLE ROW LEVEL SECURITY;

-- Backfill current legacy residence as a self-declared compatibility source.
INSERT INTO user_political_territories (
  user_id, jurisdiction_id, territory_type, territory_code,
  source, verification_level, context
)
SELECT
  u.id,
  LOWER(COALESCE(NULLIF(BTRIM(u.paese_residenza), ''), 'legacy')),
  v.territory_type,
  v.territory_code,
  'legacy_profile',
  'SELF_DECLARED',
  jsonb_build_object('legacy_field', v.legacy_field)
FROM users u
CROSS JOIN LATERAL (
  VALUES
    ('COUNTRY', u.paese_residenza::text, 'paese_residenza'),
    ('REGION', u.regione_residenza::text, 'regione_residenza'),
    ('PROVINCE', u.provincia_residenza::text, 'provincia_residenza'),
    ('MUNICIPALITY', u.comune_residenza::text, 'comune_residenza')
) AS v(territory_type, territory_code, legacy_field)
WHERE NULLIF(BTRIM(v.territory_code), '') IS NOT NULL
ON CONFLICT DO NOTHING;

-- Keep legacy residence synchronized regardless of which API path updates users.
CREATE OR REPLACE FUNCTION sync_user_legacy_political_territories()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_jurisdiction TEXT;
BEGIN
  v_jurisdiction := LOWER(COALESCE(NULLIF(BTRIM(NEW.paese_residenza), ''), 'legacy'));

  DELETE FROM user_political_territories
  WHERE user_id = NEW.id
    AND source = 'legacy_profile';

  INSERT INTO user_political_territories (
    user_id, jurisdiction_id, territory_type, territory_code,
    source, verification_level, context
  )
  SELECT
    NEW.id,
    v_jurisdiction,
    v.territory_type,
    v.territory_code,
    'legacy_profile',
    'SELF_DECLARED',
    jsonb_build_object('legacy_field', v.legacy_field)
  FROM (VALUES
    ('COUNTRY', NEW.paese_residenza::text, 'paese_residenza'),
    ('REGION', NEW.regione_residenza::text, 'regione_residenza'),
    ('PROVINCE', NEW.provincia_residenza::text, 'provincia_residenza'),
    ('MUNICIPALITY', NEW.comune_residenza::text, 'comune_residenza')
  ) AS v(territory_type, territory_code, legacy_field)
  WHERE NULLIF(BTRIM(v.territory_code), '') IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_sync_political_territories ON users;
CREATE TRIGGER users_sync_political_territories
AFTER INSERT OR UPDATE OF paese_residenza, regione_residenza, provincia_residenza, comune_residenza
ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_legacy_political_territories();

COMMIT;
