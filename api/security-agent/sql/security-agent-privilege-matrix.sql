-- Demos Security Agent — privilege matrix check (READ ONLY)
-- Run only AFTER the draft security_agent migration and the three LOGIN roles exist.
-- This script does not insert/update/delete data.

SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles
WHERE rolname IN (
  'demos_security_agent_writer', 'demos_security_center_reader',
  'demos_security_agent_maintenance', 'demos_security_agent_runtime',
  'demos_security_center_runtime', 'demos_security_retention_runtime'
)
ORDER BY rolname;

SELECT
  has_schema_privilege('demos_security_agent_writer','security_agent','USAGE') AS writer_schema_usage,
  has_table_privilege('demos_security_agent_writer','security_agent.incidents','SELECT') AS writer_incidents_select,
  has_table_privilege('demos_security_agent_writer','security_agent.incidents','INSERT') AS writer_incidents_insert,
  has_table_privilege('demos_security_agent_writer','security_agent.incidents','UPDATE') AS writer_incidents_update,
  has_table_privilege('demos_security_agent_writer','security_agent.incidents','DELETE') AS writer_incidents_delete_must_be_false,
  has_table_privilege('demos_security_agent_writer','security_agent.source_state','SELECT') AS writer_source_select,
  has_table_privilege('demos_security_agent_writer','security_agent.source_state','INSERT') AS writer_source_insert,
  has_table_privilege('demos_security_agent_writer','security_agent.source_state','UPDATE') AS writer_source_update,
  has_table_privilege('demos_security_agent_writer','security_agent.source_state','DELETE') AS writer_source_delete_must_be_false;

SELECT
  has_schema_privilege('demos_security_center_reader','security_agent','USAGE') AS reader_schema_usage,
  has_table_privilege('demos_security_center_reader','security_agent.incidents','SELECT') AS reader_incidents_select,
  has_table_privilege('demos_security_center_reader','security_agent.incidents','INSERT') AS reader_incidents_insert_must_be_false,
  has_table_privilege('demos_security_center_reader','security_agent.incidents','UPDATE') AS reader_incidents_update_must_be_false,
  has_table_privilege('demos_security_center_reader','security_agent.incidents','DELETE') AS reader_incidents_delete_must_be_false,
  has_table_privilege('demos_security_center_reader','security_agent.source_state','SELECT') AS reader_source_select;

SELECT
  has_schema_privilege('demos_security_agent_maintenance','security_agent','USAGE') AS maintenance_schema_usage,
  has_table_privilege('demos_security_agent_maintenance','security_agent.incidents','DELETE') AS maintenance_incidents_delete,
  has_table_privilege('demos_security_agent_maintenance','security_agent.incidents','INSERT') AS maintenance_insert_must_be_false,
  has_table_privilege('demos_security_agent_maintenance','security_agent.incidents','UPDATE') AS maintenance_update_must_be_false,
  has_column_privilege('demos_security_agent_maintenance','security_agent.incidents','updated_at','SELECT') AS maintenance_updated_at_select;

SELECT
  has_schema_privilege('anon','security_agent','USAGE') AS anon_usage_must_be_false,
  has_schema_privilege('authenticated','security_agent','USAGE') AS authenticated_usage_must_be_false,
  has_schema_privilege('service_role','security_agent','USAGE') AS service_role_usage_must_be_false,
  has_schema_privilege('authenticator','security_agent','USAGE') AS authenticator_usage_must_be_false;

SELECT
  pg_has_role('demos_security_agent_runtime','demos_security_agent_writer','MEMBER') AS runtime_writer_membership,
  pg_has_role('demos_security_agent_runtime','demos_security_center_reader','MEMBER') AS runtime_reader_membership_must_be_false,
  pg_has_role('demos_security_agent_runtime','demos_security_agent_maintenance','MEMBER') AS runtime_maintenance_membership_must_be_false,
  pg_has_role('demos_security_center_runtime','demos_security_center_reader','MEMBER') AS center_reader_membership,
  pg_has_role('demos_security_retention_runtime','demos_security_agent_maintenance','MEMBER') AS retention_maintenance_membership;

SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='security_agent' AND c.relname IN ('incidents','source_state')
ORDER BY c.relname;
