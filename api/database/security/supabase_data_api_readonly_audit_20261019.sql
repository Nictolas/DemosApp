-- DEMOS / Supabase Data API exposure: READ-ONLY audit.
-- Execute only in Supabase SQL Editor or on an authorized PostgreSQL connection.
-- No user records are selected; no DDL/DML is performed.
-- Project: DEMOS. Reviewed: 2026-10-19.

-- 1) Confirm application connection role and PostgREST roles.
SELECT current_user AS executing_role, session_user AS session_role;
SELECT rolname, rolcanlogin, rolbypassrls
FROM pg_roles
WHERE rolname IN ('postgres', 'anon', 'authenticated', 'service_role', 'authenticator')
ORDER BY rolname;

-- 2) Confirm schema accessibility to API roles.
SELECT role_name,
       has_schema_privilege(role_name, 'public', 'USAGE') AS can_use_public_schema
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name);

-- 3) Effective permissions + RLS for every public application table.
-- If RLS is FALSE and can_* is TRUE, that privilege is not row-restricted.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       (SELECT count(*) FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY (NOT c.relrowsecurity) DESC, c.relname;

-- 4) Review default privileges; grants for NEW tables can differ from existing ones.
SELECT pg_get_userbyid(d.defaclrole) AS object_owner,
       COALESCE(n.nspname, '<global>') AS schema_name,
       d.defaclobjtype AS object_type,
       d.defaclacl AS default_privileges
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public' OR d.defaclnamespace = 0
ORDER BY object_owner, schema_name, object_type;

-- 5) Find functions with mutable search_path for SEPARATE hardening work.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS signature,
       p.prosecdef AS security_definer,
       p.proconfig AS explicit_configuration
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS setting
    WHERE setting LIKE 'search_path=%'
  )
ORDER BY p.prosecdef DESC, p.proname;

-- Do not run mass ALTER TABLE or GRANT/REVOKE without evaluating these outputs,
-- verifying Render's live DATABASE_URL role and testing in staging.
