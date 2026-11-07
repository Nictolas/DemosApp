-- DEMOS civic staging runtime access gate — metadata only, READ-ONLY.
-- Reports NO user IDs, tokens, DB marker, connection info or credentials.
-- This checks dedicated synthetic backend role access, NOT Render affinity.
WITH required(table_name, privileges) AS (
  VALUES
    ('eci', ARRAY['SELECT','INSERT','UPDATE']::text[]),
    ('iniziative_ministero', ARRAY['SELECT','INSERT','UPDATE']::text[]),
    ('notifiche_preferenze', ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[]),
    ('civic_new_initiative_notifications', ARRAY['SELECT','INSERT','UPDATE']::text[]),
    ('civic_push_delivery_guard', ARRAY['SELECT','UPDATE']::text[]),
    ('civic_runtime_identity', ARRAY['SELECT']::text[])
), runtime AS (
  SELECT oid,rolcanlogin,rolbypassrls,rolsuper
  FROM pg_roles WHERE rolname = 'demos_staging_runtime'
), observed AS (
  SELECT req.table_name, req.privileges,
         cls.oid AS table_oid, cls.relrowsecurity AS rls_enabled,
         (SELECT oid FROM runtime) AS role_oid,
         EXISTS (
           SELECT 1 FROM pg_policies p
           WHERE p.schemaname='public'
             AND p.tablename=req.table_name
             AND 'demos_staging_runtime'=ANY(p.roles)
         ) AS policy_present,
         EXISTS (
           SELECT 1 FROM pg_roles r
           WHERE r.rolname IN ('anon','authenticated')
             AND cls.oid IS NOT NULL
             AND (has_table_privilege(r.oid,cls.oid,'SELECT')
               OR has_table_privilege(r.oid,cls.oid,'INSERT')
               OR has_table_privilege(r.oid,cls.oid,'UPDATE')
               OR has_table_privilege(r.oid,cls.oid,'DELETE'))
         ) AS client_direct_access
  FROM required req
  LEFT JOIN pg_class cls
    ON cls.oid=to_regclass(format('public.%I',req.table_name))
)
SELECT table_name,
  CASE WHEN table_oid IS NULL THEN 'MISSING_TABLE'
       WHEN NOT COALESCE(rls_enabled,FALSE) THEN 'RLS_DISABLED'
       WHEN role_oid IS NULL THEN 'STAGING_RUNTIME_ROLE_MISSING'
       WHEN NOT (SELECT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper FROM runtime)
         THEN 'STAGING_RUNTIME_ROLE_UNSAFE'
       WHEN client_direct_access THEN 'CLIENT_ROLE_EXPOSED'
       WHEN NOT policy_present THEN 'STAGING_RUNTIME_POLICY_MISSING'
       WHEN EXISTS (
         SELECT 1 FROM unnest(privileges) AS p(privilege)
         WHERE has_table_privilege(role_oid,table_oid,p.privilege) IS DISTINCT FROM TRUE
       ) THEN 'STAGING_RUNTIME_GRANT_MISSING'
       WHEN table_name='civic_new_initiative_notifications' AND NOT
         has_sequence_privilege(role_oid,
           to_regclass('public.civic_new_initiative_notifications_id_seq'),'USAGE')
         THEN 'STAGING_RUNTIME_SEQUENCE_GRANT_MISSING'
       ELSE 'STRUCTURE_OK'
  END AS runtime_gate
FROM observed
ORDER BY table_name;
