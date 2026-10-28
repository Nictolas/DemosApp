-- DEMOS: deterministic political territory fixture; STAGING QA SCHEMA ONLY.
-- Replicates the verified production legacy trigger semantics without touching public.
-- All records are synthetic. No API roles may read this schema.
CREATE TABLE IF NOT EXISTS qa_user_profile_20261028.user_political_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES qa_user_profile_20261028.users(id) ON DELETE CASCADE,
  jurisdiction_id text NOT NULL,
  territory_type text NOT NULL CHECK (territory_type IN
    ('SUPRANATIONAL','COUNTRY','ADMIN_LEVEL_1','ADMIN_LEVEL_2','REGION','PROVINCE','MUNICIPALITY','ELECTORAL_DISTRICT')),
  territory_code text NOT NULL CHECK (BTRIM(territory_code) <> ''),
  political_office_id text,
  source text NOT NULL DEFAULT 'system',
  verification_level text NOT NULL DEFAULT 'SELF_DECLARED'
    CHECK (verification_level IN ('SELF_DECLARED','VERIFIED','OFFICIAL')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz CHECK (valid_to IS NULL OR valid_to >= valid_from),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_profile_territories_active
  ON qa_user_profile_20261028.user_political_territories (
    user_id,jurisdiction_id,territory_type,territory_code,
    COALESCE(political_office_id,''),source
  ) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_qa_profile_territories_lookup
  ON qa_user_profile_20261028.user_political_territories (user_id,territory_type,political_office_id)
  WHERE valid_to IS NULL;
ALTER TABLE qa_user_profile_20261028.user_political_territories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_user_profile_20261028.user_political_territories FROM PUBLIC, anon, authenticated, service_role;

-- An exact semantic replica of the legacy users trigger in a private, namespaced function.
CREATE OR REPLACE FUNCTION qa_user_profile_20261028.sync_legacy_residence_territories()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'qa_user_profile_20261028', 'pg_temp'
AS $fn$
DECLARE v_jurisdiction text;
BEGIN
  v_jurisdiction := LOWER(COALESCE(NULLIF(BTRIM(NEW.paese_residenza), ''), 'legacy'));
  DELETE FROM user_political_territories
    WHERE user_id=NEW.id AND source='legacy_profile';
  INSERT INTO user_political_territories
    (user_id,jurisdiction_id,territory_type,territory_code,source,verification_level,context)
  SELECT NEW.id,v_jurisdiction,v.territory_type,v.territory_code,
         'legacy_profile','SELF_DECLARED',jsonb_build_object('legacy_field',v.legacy_field)
  FROM (VALUES
    ('COUNTRY', NEW.paese_residenza::text, 'paese_residenza'),
    ('REGION', NEW.regione_residenza::text, 'regione_residenza'),
    ('PROVINCE', NEW.provincia_residenza::text, 'provincia_residenza'),
    ('MUNICIPALITY', NEW.comune_residenza::text, 'comune_residenza')
  ) AS v(territory_type,territory_code,legacy_field)
  WHERE NULLIF(BTRIM(v.territory_code),'') IS NOT NULL;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS qa_users_sync_political_territories ON qa_user_profile_20261028.users;
CREATE TRIGGER qa_users_sync_political_territories
  AFTER INSERT OR UPDATE OF paese_residenza,regione_residenza,provincia_residenza,comune_residenza
  ON qa_user_profile_20261028.users
  FOR EACH ROW EXECUTE FUNCTION qa_user_profile_20261028.sync_legacy_residence_territories();

-- Candidate for a future separate, reviewed migration; kept inactive in staging.
-- The legacy source label is intentionally preserved for downstream compatibility.
CREATE OR REPLACE FUNCTION qa_user_profile_20261028.sync_canonical_residence_territories()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'qa_user_profile_20261028','pg_temp'
AS $fn$
DECLARE v_jurisdiction text;
BEGIN
  v_jurisdiction := LOWER(COALESCE(NULLIF(BTRIM(NEW.paese_residenza), ''), 'legacy'));
  DELETE FROM user_political_territories
    WHERE user_id=NEW.user_id AND source='legacy_profile';
  INSERT INTO user_political_territories
    (user_id,jurisdiction_id,territory_type,territory_code,source,verification_level,context)
  SELECT NEW.user_id,v_jurisdiction,v.territory_type,v.territory_code,
         'legacy_profile','SELF_DECLARED',jsonb_build_object('legacy_field',v.legacy_field)
  FROM (VALUES
    ('COUNTRY', NEW.paese_residenza::text, 'paese_residenza'),
    ('REGION', NEW.regione_residenza::text, 'regione_residenza'),
    ('PROVINCE', NEW.provincia_residenza::text, 'provincia_residenza'),
    ('MUNICIPALITY', NEW.comune_residenza::text, 'comune_residenza')
  ) AS v(territory_type,territory_code,legacy_field)
  WHERE NULLIF(BTRIM(v.territory_code),'') IS NOT NULL;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION qa_user_profile_20261028.sync_legacy_residence_territories() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION qa_user_profile_20261028.sync_canonical_residence_territories() FROM PUBLIC, anon, authenticated, service_role;
