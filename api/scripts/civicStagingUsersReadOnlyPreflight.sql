-- DEMOS — additional civic notification runtime prerequisite, READ ONLY.
-- Does NOT replace the existing seven-table civic staging preflight.
-- Checks only public.users metadata; does not read accounts, identifiers,
-- status values, tokens, credentials or permissions outside pg_catalog.
--
-- Required by civicPushDeliveryGuard.readCivicDeliveryBarrier and the
-- topic bootstrap LEFT JOIN users + status = 'a'.
-- A seven-table STRUCTURE_OK result alone is insufficient for rollout.

WITH prerequisite AS (
  SELECT c.oid, c.relrowsecurity
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'users'
    AND c.relkind IN ('r', 'p')
),
observed AS (
  SELECT
    EXISTS (SELECT 1 FROM prerequisite) AS table_present,
    COALESCE((SELECT relrowsecurity FROM prerequisite), FALSE) AS rls_enabled,
    ARRAY(
      SELECT a.attname
      FROM pg_catalog.pg_attribute AS a
      WHERE a.attrelid = (SELECT oid FROM prerequisite)
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attname
    ) AS actual_columns
)
SELECT
  'users'::text AS table_name,
  table_present,
  ARRAY(
    SELECT unnest(ARRAY['id','status']::text[])
    EXCEPT SELECT unnest(actual_columns)
    ORDER BY 1
  ) AS missing_columns,
  rls_enabled,
  CASE WHEN NOT table_present THEN 'MISSING_TABLE'
       WHEN EXISTS (
         SELECT unnest(ARRAY['id','status']::text[])
         EXCEPT SELECT unnest(actual_columns)
       ) THEN 'MISSING_COLUMN'
       WHEN NOT rls_enabled THEN 'RLS_DISABLED'
       ELSE 'STRUCTURE_OK'
  END AS dependency_gate
FROM observed;
