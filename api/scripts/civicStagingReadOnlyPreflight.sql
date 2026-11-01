-- DEMOS civic-notification staging preflight. READ ONLY.
-- Paste into an AUTHORIZED staging SQL console. Never run migration here.
-- Reports only structural metadata; no accounts, tokens, UUID marker or secrets.
WITH required(table_name, required_columns, rls_required) AS (
  VALUES
    ('eci', ARRAY['id','title']::text[], FALSE),
    ('iniziative_ministero', ARRAY['id_ministero','titolo','tipo','stato','data_fine']::text[], FALSE),
    ('notifiche_preferenze', ARRAY['user_id','iniziative_popolari','referendum_abrogativi','eci']::text[], TRUE),
    ('user_devices', ARRAY['id','user_id','fcm_token','is_active']::text[], TRUE),
    ('civic_new_initiative_notifications', ARRAY['category','official_id','status']::text[], TRUE),
    ('civic_push_delivery_guard', ARRAY['id','blocked','reason_code']::text[], TRUE),
    ('civic_runtime_identity', ARRAY['id','db_identity']::text[], TRUE)
),
observed AS (
  SELECT r.table_name, r.required_columns, r.rls_required,
    c.oid IS NOT NULL AS table_present,
    coalesce(c.relrowsecurity, FALSE) AS rls_enabled,
    coalesce(array_agg(a.attname) FILTER (WHERE a.attname IS NOT NULL), ARRAY[]::text[]) AS actual_columns
  FROM required r
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid
     AND c.relname = r.table_name AND c.relkind IN ('r','p')
  LEFT JOIN pg_attribute a ON a.attrelid = c.oid
     AND a.attnum > 0 AND NOT a.attisdropped
  GROUP BY r.table_name,r.required_columns,r.rls_required,c.oid,c.relrowsecurity
)
SELECT table_name, table_present,
  ARRAY(SELECT unnest(required_columns) EXCEPT SELECT unnest(actual_columns)
        ORDER BY 1) AS missing_columns,
  rls_required, rls_enabled,
  CASE WHEN NOT table_present THEN 'MISSING_TABLE'
       WHEN EXISTS (SELECT unnest(required_columns) EXCEPT SELECT unnest(actual_columns))
         THEN 'MISSING_COLUMN'
       WHEN rls_required AND NOT rls_enabled THEN 'RLS_DISABLED'
       ELSE 'STRUCTURE_OK'
  END AS schema_gate
FROM observed
ORDER BY table_name;
