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

REVOKE ALL ON SCHEMA security_agent FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA security_agent FROM PUBLIC;

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
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demos_security_agent_writer') THEN
    CREATE ROLE demos_security_agent_writer NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demos_security_center_reader') THEN
    CREATE ROLE demos_security_center_reader NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA security_agent TO demos_security_agent_writer, demos_security_center_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON security_agent.incidents TO demos_security_agent_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON security_agent.source_state TO demos_security_agent_writer;
GRANT SELECT ON security_agent.incidents, security_agent.source_state TO demos_security_center_reader;

ALTER TABLE security_agent.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_agent.source_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_agent_writer_incidents ON security_agent.incidents;
CREATE POLICY security_agent_writer_incidents ON security_agent.incidents
  FOR ALL TO demos_security_agent_writer USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS security_center_reader_incidents ON security_agent.incidents;
CREATE POLICY security_center_reader_incidents ON security_agent.incidents
  FOR SELECT TO demos_security_center_reader USING (true);

DROP POLICY IF EXISTS security_agent_writer_source_state ON security_agent.source_state;
CREATE POLICY security_agent_writer_source_state ON security_agent.source_state
  FOR ALL TO demos_security_agent_writer USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS security_center_reader_source_state ON security_agent.source_state;
CREATE POLICY security_center_reader_source_state ON security_agent.source_state
  FOR SELECT TO demos_security_center_reader USING (true);

COMMIT;
