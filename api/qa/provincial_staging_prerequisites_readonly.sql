-- DEMOS provincial representatives (#627): staging-only, metadata-only preflight.
-- Run by an authorized operator in Demos-Staging (project fkeayjzvtuvzesljhjbc).
-- This script never queries application rows and never changes privileges,
-- policies, schema, data, credentials or environment variables.
-- It is NOT a staging GO: a declared RLS policy can still deny all rows.
WITH required (relation_name, mandatory_for_e2e, purpose) AS (
  VALUES
    ('users', true, 'residence/consent'),
    ('user_consents', true, 'current consent'),
    ('political_selections', true, 'canonical selection'),
    ('political_mandates', true, 'provincial representatives'),
    ('political_candidacies', true, 'provincial candidates'),
    ('eventi', true, 'candidate election event'),
    ('unita_elettorale', true, 'candidate electoral unit'),
    ('unita_elettorale_territorio', true, 'candidate unit territory'),
    ('user_political_territories', false, 'canonical residence (legacy fallback exists)'),
    ('user_electoral_unit_memberships', false, 'canonical electoral membership (legacy fallback exists)')
),
inventory AS (
  SELECT r.relation_name, r.mandatory_for_e2e, r.purpose,
         c.oid AS relation_oid,
         COALESCE(c.relrowsecurity, false) AS rls_enabled,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'SELECT')
         END AS runtime_can_select,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'INSERT')
         END AS runtime_can_insert,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'UPDATE')
         END AS runtime_can_update,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'DELETE')
         END AS runtime_can_delete,
         EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy p
           WHERE p.polrelid = c.oid
             AND p.polcmd IN ('r', '*')
             AND (0 = ANY(p.polroles)
                  OR 'demos_staging_runtime'::regrole::oid = ANY(p.polroles))
         ) AS runtime_read_policy_declared
  FROM required r
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = n.oid
   AND c.relname = r.relation_name
   AND c.relkind IN ('r', 'p')
)
SELECT relation_name, mandatory_for_e2e, purpose,
       relation_oid IS NOT NULL AS exists_in_public,
       runtime_can_select, rls_enabled, runtime_read_policy_declared,
       runtime_can_insert, runtime_can_update, runtime_can_delete,
       CASE
         WHEN relation_oid IS NULL
           THEN CASE WHEN mandatory_for_e2e
                     THEN 'BLOCKED_MISSING_RELATION'
                     ELSE 'OPTIONAL_SCHEMA_ABSENT' END
         WHEN NOT runtime_can_select THEN 'BLOCKED_NO_SELECT_GRANT'
         WHEN NOT rls_enabled THEN 'BLOCKED_RLS_DISABLED'
         WHEN NOT runtime_read_policy_declared THEN 'BLOCKED_NO_RUNTIME_READ_POLICY'
         ELSE 'METADATA_PASS_NOT_E2E_GO'
       END AS gate_status
FROM inventory
ORDER BY mandatory_for_e2e DESC, relation_name;
