-- Demos Security Agent - Durable Security Store v1
-- DRAFT ONLY: non applicare finché retention/DPIA e credenziali dedicate non sono approvate.
-- Nessun dato Identity/Research, nessuna opinione politica, nessun raw event.

BEGIN;

CREATE SCHEMA IF NOT EXISTS security_agent;

CREATE TABLE IF NOT EXISTS security_agent.incidents (
  incident_id varchar(160) PRIMARY KEY,
  finding_id varchar(160) NOT NULL,
  rule_id varchar(160) NOT NULL,
  severity varchar(16) NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  status varchar(16) NOT NULL CHECK (status IN ('open','acknowledged','resolved')),
  event_count integer NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  first_seen timestamptz NOT NULL,
  last_seen timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS security_agent.source_state (
  source_name varchar(80) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  watermark timestamptz NULL,
  last_poll_started_at timestamptz NULL,
  last_success_at timestamptz NULL,
  last_failure_at timestamptz NULL,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  total_polls bigint NOT NULL DEFAULT 0 CHECK (total_polls >= 0),
  total_fetched bigint NOT NULL DEFAULT 0 CHECK (total_fetched >= 0),
  total_accepted bigint NOT NULL DEFAULT 0 CHECK (total_accepted >= 0),
  total_duplicates bigint NOT NULL DEFAULT 0 CHECK (total_duplicates >= 0),
  stored_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_agent_incidents_updated_at
  ON security_agent.incidents (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_agent_incidents_status_severity
  ON security_agent.incidents (status, severity, updated_at DESC);

-- Fail closed for Supabase/PostgREST roles, even if this schema is exposed later.
REVOKE ALL ON SCHEMA security_agent FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA security_agent FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA security_agent FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA security_agent FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA security_agent FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA security_agent FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA security_agent FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA security_agent FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA security_agent FROM service_role';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA security_agent FROM service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA security_agent FROM authenticator';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA security_agent FROM authenticator';
  END IF;
END $$;

-- Group roles only. LOGIN credentials are created separately after the Privacy/DPIA gate.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demos_security_agent_writer') THEN
    CREATE ROLE demos_security_agent_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demos_security_center_reader') THEN
    CREATE ROLE demos_security_center_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demos_security_agent_maintenance') THEN
    CREATE ROLE demos_security_agent_maintenance NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA security_agent TO
  demos_security_agent_writer,
  demos_security_center_reader,
  demos_security_agent_maintenance;

-- Runtime writer cannot delete evidence.
GRANT SELECT, INSERT, UPDATE ON security_agent.incidents TO demos_security_agent_writer;
GRANT SELECT, INSERT, UPDATE ON security_agent.source_state TO demos_security_agent_writer;

-- Admin Security Center is strictly read-only at DB level.
GRANT SELECT ON security_agent.incidents, security_agent.source_state TO demos_security_center_reader;

-- Retention deletion is isolated behind a separate credential/role.
GRANT DELETE ON security_agent.incidents TO demos_security_agent_maintenance;
GRANT SELECT (updated_at) ON security_agent.incidents TO demos_security_agent_maintenance;

ALTER TABLE security_agent.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_agent.source_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_agent.incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE security_agent.source_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_agent_writer_incidents_select ON security_agent.incidents;
CREATE POLICY security_agent_writer_incidents_select ON security_agent.incidents
  FOR SELECT TO demos_security_agent_writer USING (true);
DROP POLICY IF EXISTS security_agent_writer_incidents_insert ON security_agent.incidents;
CREATE POLICY security_agent_writer_incidents_insert ON security_agent.incidents
  FOR INSERT TO demos_security_agent_writer WITH CHECK (true);
DROP POLICY IF EXISTS security_agent_writer_incidents_update ON security_agent.incidents;
CREATE POLICY security_agent_writer_incidents_update ON security_agent.incidents
  FOR UPDATE TO demos_security_agent_writer USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS security_center_reader_incidents ON security_agent.incidents;
CREATE POLICY security_center_reader_incidents ON security_agent.incidents
  FOR SELECT TO demos_security_center_reader USING (true);
DROP POLICY IF EXISTS security_agent_maintenance_incidents ON security_agent.incidents;
CREATE POLICY security_agent_maintenance_incidents ON security_agent.incidents
  FOR DELETE TO demos_security_agent_maintenance USING (true);

DROP POLICY IF EXISTS security_agent_writer_source_state_select ON security_agent.source_state;
CREATE POLICY security_agent_writer_source_state_select ON security_agent.source_state
  FOR SELECT TO demos_security_agent_writer USING (true);
DROP POLICY IF EXISTS security_agent_writer_source_state_insert ON security_agent.source_state;
CREATE POLICY security_agent_writer_source_state_insert ON security_agent.source_state
  FOR INSERT TO demos_security_agent_writer WITH CHECK (true);
DROP POLICY IF EXISTS security_agent_writer_source_state_update ON security_agent.source_state;
CREATE POLICY security_agent_writer_source_state_update ON security_agent.source_state
  FOR UPDATE TO demos_security_agent_writer USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS security_center_reader_source_state ON security_agent.source_state;
CREATE POLICY security_center_reader_source_state ON security_agent.source_state
  FOR SELECT TO demos_security_center_reader USING (true);

-- Future objects must remain fail-closed for Supabase API roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA security_agent REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA security_agent REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA security_agent REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
