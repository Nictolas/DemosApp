-- DEMOS capability model v1
-- Additive migration: keeps users.ruolo and legacy geography columns during transition.
-- Safe objective: PERSON / INSTITUTION / ORGANIZATION + composable admin/activist flags
-- + relational candidacies and mandates. Election identity is the existing eventi.id row with tipologia_evento = Elezioni; electoral_unit_id refers to the existing unita_elettorale.id when known.

BEGIN;

-- This is the historical long-label bootstrap. Never re-apply it after the
-- P/O/E cutover: its old default and constraints would reject new accounts.
DO $compact_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.users'::regclass
      AND a.attname = 'account_type'
      AND pg_get_expr(d.adbin, d.adrelid) LIKE '%''P''%'
  ) THEN
    RAISE EXCEPTION 'Legacy account type bootstrap cannot run after compact P/O/E cutover';
  END IF;
END;
$compact_guard$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_activist BOOLEAN;

UPDATE users
SET account_type = CASE
  WHEN ruolo IN ('I', 'Istituzione') THEN 'INSTITUTION'
  WHEN ruolo IN ('O', 'Organizzazione') THEN 'ORGANIZATION'
  ELSE 'PERSON'
END
WHERE account_type IS NULL;

UPDATE users
SET is_admin = (ruolo IN ('AD', 'Admin'))
WHERE is_admin IS NULL;

UPDATE users
SET is_activist = (ruolo IN ('A', 'Attivista'))
WHERE is_activist IS NULL;

ALTER TABLE users ALTER COLUMN account_type SET DEFAULT 'PERSON';
ALTER TABLE users ALTER COLUMN account_type SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_admin SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN is_admin SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_activist SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN is_activist SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_account_type_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('PERSON', 'INSTITUTION', 'ORGANIZATION'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);
CREATE INDEX IF NOT EXISTS idx_users_is_admin_true ON users(id) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_activist_true ON users(id) WHERE is_activist = TRUE;

-- Canonical electoral-unit layer. We reuse the existing table names already consumed by DEMOS
-- and extend them with jurisdiction-neutral fields instead of creating a parallel Italy-only model.
CREATE TABLE IF NOT EXISTS unita_elettorale (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL
);
ALTER TABLE unita_elettorale ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE unita_elettorale ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE unita_elettorale ADD COLUMN IF NOT EXISTS unit_type TEXT;
ALTER TABLE unita_elettorale ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_unita_elettorale_evento ON unita_elettorale(evento_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_unita_elettorale_evento_code
  ON unita_elettorale(evento_id, code) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS unita_elettorale_territorio (
  unita_elettorale_id UUID NOT NULL,
  regione_codice TEXT NULL
);
ALTER TABLE unita_elettorale_territorio ADD COLUMN IF NOT EXISTS territory_type TEXT;
ALTER TABLE unita_elettorale_territorio ADD COLUMN IF NOT EXISTS territory_code TEXT;
ALTER TABLE unita_elettorale_territorio ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Preserve the already used regional mapping while moving toward the generic territory_type/code pair.
UPDATE unita_elettorale_territorio
SET territory_type = COALESCE(territory_type, 'REGION'),
    territory_code = COALESCE(territory_code, regione_codice)
WHERE regione_codice IS NOT NULL
  AND (territory_type IS NULL OR territory_code IS NULL);

CREATE INDEX IF NOT EXISTS idx_unita_elettorale_territorio_unit
  ON unita_elettorale_territorio(unita_elettorale_id);
CREATE INDEX IF NOT EXISTS idx_unita_elettorale_territorio_generic
  ON unita_elettorale_territorio(territory_type, territory_code);

CREATE TABLE IF NOT EXISTS political_candidacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  election_event_id UUID NULL,
  electoral_unit_id UUID NULL,
  jurisdiction JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NULL,
  result VARCHAR(20) NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'DEMOS',
  legacy_context JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('PENDING', 'ACTIVE', 'WITHDRAWN', 'ENDED', 'CANCELLED')),
  CHECK (result IS NULL OR result IN ('ELECTED', 'NOT_ELECTED', 'UNKNOWN')),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_political_candidacies_user_active
  ON political_candidacies(user_id)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_political_candidacies_election_event
  ON political_candidacies(election_event_id)
  WHERE election_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_political_candidacies_electoral_unit
  ON political_candidacies(electoral_unit_id)
  WHERE electoral_unit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_political_candidacies_legacy_active
  ON political_candidacies(user_id)
  WHERE source = 'LEGACY_BACKFILL' AND status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_political_candidacies_active_election_unit
  ON political_candidacies(user_id, election_event_id, electoral_unit_id)
  WHERE status = 'ACTIVE' AND election_event_id IS NOT NULL AND electoral_unit_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS political_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  election_event_id UUID NULL,
  office_code TEXT NULL,
  institution_code TEXT NULL,
  jurisdiction JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'DEMOS',
  legacy_context JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELLED')),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_political_mandates_user_active
  ON political_mandates(user_id)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_political_mandates_election_event
  ON political_mandates(election_event_id)
  WHERE election_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_political_mandates_office
  ON political_mandates(office_code)
  WHERE office_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_political_mandates_legacy_active
  ON political_mandates(user_id)
  WHERE source = 'LEGACY_BACKFILL' AND status = 'ACTIVE';

-- First preserve any real election/unit linkage already present in the legacy candidati table.
DO $migration$
BEGIN
  IF to_regclass('public.candidati') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO political_candidacies (
        user_id, election_event_id, electoral_unit_id, jurisdiction, status, source, legacy_context
      )
      SELECT
        u.id,
        c.evento_id,
        c.unita_elettorale_id,
        jsonb_strip_nulls(jsonb_build_object(
          'country', u.paese_candidatura,
          'region', u.regione_candidatura,
          'province', u.provincia_candidatura,
          'municipality', u.comune_candidatura,
          'level', u.grado_candidatura
        )),
        'ACTIVE',
        'LEGACY_CANDIDATI',
        jsonb_build_object('legacy_role', u.ruolo)
      FROM candidati c
      JOIN users u ON u.id = c.user_id
      WHERE u.account_type = 'PERSON'
        AND u.ruolo IN ('C', 'CP', 'Candidato', 'Candidato Politico')
        AND NOT EXISTS (
          SELECT 1
          FROM political_candidacies pc
          WHERE pc.user_id = u.id
            AND pc.election_event_id = c.evento_id
            AND pc.electoral_unit_id = c.unita_elettorale_id
            AND pc.status = 'ACTIVE'
        )
    $sql$;
  END IF;
END
$migration$;

-- Compatibility backfill only. These rows preserve current behaviour until each
-- legacy P/C/CP record is linked to a canonical election/mandate by staff/import.
INSERT INTO political_candidacies (
  user_id, election_event_id, electoral_unit_id, jurisdiction, status, source, legacy_context
)
SELECT
  u.id,
  NULL,
  NULL,
  jsonb_strip_nulls(jsonb_build_object(
    'country', u.paese_candidatura,
    'region', u.regione_candidatura,
    'province', u.provincia_candidatura,
    'municipality', u.comune_candidatura,
    'level', u.grado_candidatura
  )),
  'ACTIVE',
  'LEGACY_BACKFILL',
  jsonb_build_object('legacy_role', u.ruolo)
FROM users u
WHERE u.account_type = 'PERSON'
  AND u.ruolo IN ('C', 'CP', 'Candidato', 'Candidato Politico')
  AND NOT EXISTS (
    SELECT 1 FROM political_candidacies pc
    WHERE pc.user_id = u.id AND pc.status = 'ACTIVE'
  );

-- FAIL CLOSED: an imported legacy role 'P' is NOT evidence that a political
-- mandate is currently active. In particular, a former deputy may now be a
-- senator; copying users.grado_elezione to an ACTIVE mandate fabricates a
-- second simultaneous office, and NOW() is the migration time, not the start.
--
-- Only a verified, dated mandate may be inserted by an identity-first import
-- process. Abort this entire migration rather than fabricate a public office
-- or quietly downgrade legacy political accounts via role projection below.
-- Existing production LEGACY_BACKFILL rows are NOT modified by this guard:
-- they require a separate, audited remediation backed by official records.
DO $unverified_mandate_guard$
DECLARE
  unresolved_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO unresolved_count
  FROM users u
  WHERE u.account_type = 'PERSON'
    AND u.ruolo IN ('P', 'CP', 'Politico', 'Candidato Politico')
    AND NOT EXISTS (
      SELECT 1 FROM political_mandates pm
      WHERE pm.user_id = u.id AND pm.status = 'ACTIVE'
        -- A migration-created ACTIVE row is not evidence that the office exists.
        AND pm.source <> 'LEGACY_BACKFILL'
        AND (pm.starts_at IS NULL OR pm.starts_at <= NOW())
        AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
    );

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'Unverified legacy politician mandates: % users require identity-first verification; migration aborted before role projection',
      unresolved_count
      USING ERRCODE = 'P0001',
            HINT = 'Verify current and historical offices from institutional identifiers, then insert dated mandates explicitly. Do not create LEGACY_BACKFILL/ACTIVE from users.grado_elezione.';
  END IF;
END
$unverified_mandate_guard$;

-- During the transition, users.ruolo is maintained only as a compatibility projection.
-- New authorization/business logic should consume account_type/flags/relations instead.
CREATE OR REPLACE FUNCTION refresh_users_legacy_role(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_type VARCHAR(20);
  v_is_admin BOOLEAN;
  v_is_activist BOOLEAN;
  v_is_candidate BOOLEAN;
  v_is_politician BOOLEAN;
  v_legacy_role VARCHAR(3);
BEGIN
  SELECT account_type, is_admin, is_activist
  INTO v_account_type, v_is_admin, v_is_activist
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM political_candidacies pc
    WHERE pc.user_id = p_user_id
      AND pc.status = 'ACTIVE'
      AND pc.starts_at <= NOW()
      AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
  ) INTO v_is_candidate;

  SELECT EXISTS (
    SELECT 1 FROM political_mandates pm
    WHERE pm.user_id = p_user_id
      AND pm.status = 'ACTIVE'
      -- Legacy imports do not establish a presently held office.
      AND pm.source <> 'LEGACY_BACKFILL'
      AND pm.starts_at <= NOW()
      AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
  ) INTO v_is_politician;

  v_legacy_role := CASE
    WHEN v_account_type = 'INSTITUTION' THEN 'I'
    WHEN v_account_type = 'ORGANIZATION' THEN 'O'
    WHEN v_is_admin THEN 'AD'
    WHEN v_is_politician AND v_is_candidate THEN 'CP'
    WHEN v_is_politician THEN 'P'
    WHEN v_is_candidate THEN 'C'
    WHEN v_is_activist THEN 'A'
    ELSE 'E'
  END;

  UPDATE users
  SET ruolo = v_legacy_role
  WHERE id = p_user_id
    AND ruolo IS DISTINCT FROM v_legacy_role;
END;
$$;

CREATE OR REPLACE FUNCTION trg_refresh_users_legacy_role_from_relation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_users_legacy_role(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_users_legacy_role(NEW.user_id);
  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM refresh_users_legacy_role(OLD.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_refresh_users_legacy_role_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_users_legacy_role(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS political_candidacies_refresh_legacy_role ON political_candidacies;
CREATE TRIGGER political_candidacies_refresh_legacy_role
AFTER INSERT OR UPDATE OR DELETE ON political_candidacies
FOR EACH ROW EXECUTE FUNCTION trg_refresh_users_legacy_role_from_relation();

DROP TRIGGER IF EXISTS political_mandates_refresh_legacy_role ON political_mandates;
CREATE TRIGGER political_mandates_refresh_legacy_role
AFTER INSERT OR UPDATE OR DELETE ON political_mandates
FOR EACH ROW EXECUTE FUNCTION trg_refresh_users_legacy_role_from_relation();

DROP TRIGGER IF EXISTS users_capabilities_refresh_legacy_role ON users;
CREATE TRIGGER users_capabilities_refresh_legacy_role
AFTER UPDATE OF account_type, is_admin, is_activist ON users
FOR EACH ROW EXECUTE FUNCTION trg_refresh_users_legacy_role_from_user();

-- Normalize the legacy projection after backfill.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM users LOOP
    PERFORM refresh_users_legacy_role(r.id);
  END LOOP;
END;
$$;

COMMIT;
