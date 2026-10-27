-- Demos-Staging fkeayjzvtuvzesljhjbc ONLY.
-- READ-ONLY catalogue + aggregate synthetic fixture counts.
-- Do not run against production or copy event payloads.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       (SELECT count(*) FROM pg_catalog.pg_policy p
        WHERE p.polrelid = c.oid) AS policy_count,
       pg_catalog.has_table_privilege('demos_staging_runtime',c.oid,'SELECT') AS writer_can_select,
       pg_catalog.has_table_privilege('demos_staging_runtime',c.oid,'INSERT') AS writer_can_insert,
       pg_catalog.has_table_privilege('demos_staging_runtime',c.oid,'UPDATE') AS writer_can_update,
       pg_catalog.has_table_privilege('demos_staging_runtime',c.oid,'DELETE') AS writer_can_delete,
       (SELECT count(*) FROM pg_catalog.pg_roles r
        WHERE r.rolname IN ('anon','authenticated','service_role')
          AND (pg_catalog.has_any_column_privilege(r.rolname,c.oid,'SELECT')
          OR pg_catalog.has_any_column_privilege(r.rolname,c.oid,'INSERT')
          OR pg_catalog.has_any_column_privilege(r.rolname,c.oid,'UPDATE')
          OR pg_catalog.has_table_privilege(r.rolname,c.oid,'DELETE'))
       ) AS api_roles_with_data_grants
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('users','user_consents','opinioni_risposte',
                    'political_selections','user_representatives','privacy_erasure_ledger')
ORDER BY c.relname;

SELECT rolname, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole, rolcreatedb
FROM pg_catalog.pg_roles WHERE rolname = 'demos_staging_runtime';

SELECT (SELECT count(*) FROM public.users) AS synthetic_users,
       (SELECT count(*) FROM public.user_consents) AS synthetic_consents,
       (SELECT count(*) FROM public.opinioni_risposte) AS synthetic_opinions,
       (SELECT count(*) FROM public.political_selections) AS synthetic_selections,
       (SELECT count(*) FROM public.user_representatives) AS synthetic_representatives,
       (SELECT count(*) FROM public.privacy_erasure_ledger) AS ledger_events,
       (SELECT count(*) FROM public.users
        WHERE id NOT IN ('00000000-0000-4000-8000-000000000301'::uuid,
                         '00000000-0000-4000-8000-000000000302'::uuid)
       ) AS unexpected_users;