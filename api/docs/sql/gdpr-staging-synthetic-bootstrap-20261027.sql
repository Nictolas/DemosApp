-- OPERATOR ONLY / Demos-Staging Supabase project fkeayjzvtuvzesljhjbc
-- Atomic single-statement DDL; NEVER run against production.
-- No secrets. The LOGIN role has PASSWORD NULL and cannot authenticate.
DO $gdpr_staging$
DECLARE rel text; found integer; exposed integer;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres'
     OR current_setting('server_version_num')::int < 170000 THEN
    RAISE EXCEPTION 'GDPR_STAGING_INVALID_EXECUTION_CONTEXT';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='demos_staging_runtime')
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
       ON n.oid=c.relnamespace WHERE n.nspname='public'
       AND c.relname=ANY(ARRAY['users','user_consents','opinioni_risposte','political_selections','user_representatives','privacy_erasure_ledger'])) THEN
    RAISE EXCEPTION 'GDPR_STAGING_PREEXISTING_OBJECT_ABORT';
  END IF;
  CREATE ROLE demos_staging_runtime WITH LOGIN PASSWORD NULL NOSUPERUSER
    NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE TABLE public.users (
  id uuid PRIMARY KEY, nome text NOT NULL, ruolo text NOT NULL,
  rappresentante_camera uuid, candidato_comune uuid,
  candidato_attivo boolean NOT NULL DEFAULT false, energia_nucleare text,
  political_opinions_consent boolean NOT NULL DEFAULT false,
  political_opinions_consent_timestamp timestamptz,
  political_opinions_consent_ip_address text,
  political_opinions_consent_user_agent text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_consents (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  political_opinions_consent boolean NOT NULL DEFAULT false,
  political_opinions_consent_timestamp timestamptz,
  political_opinions_consent_ip_address text,
  political_opinions_consent_user_agent text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.opinioni_risposte (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  energia_nucleare text
);
CREATE TABLE public.political_selections (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  selected_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  selection_kind text NOT NULL,
  PRIMARY KEY (user_id, selected_user_id, selection_kind)
);
CREATE TABLE public.user_representatives (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  rappresentante_camera uuid, candidato_comune uuid
);
CREATE TABLE public.privacy_erasure_ledger (
  event_key text PRIMARY KEY, subject_user_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'account_deleted','political_consent_revoked','political_consent_granted'
  )), occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_privacy_erasure_ledger_subject_time
  ON public.privacy_erasure_ledger(subject_user_id, occurred_at DESC);
  -- Supabase legacy default privileges could grant Data API roles access
  -- to newly-created public tables. Revoke before this statement commits.
  FOR rel IN SELECT unnest(ARRAY['users','user_consents','opinioni_risposte','political_selections','user_representatives','privacy_erasure_ledger']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',rel);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',rel);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',rel);
  END LOOP;
  GRANT USAGE ON SCHEMA public TO demos_staging_runtime;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.users, public.user_consents, public.opinioni_risposte,
    public.political_selections, public.user_representatives
    TO demos_staging_runtime;
  GRANT SELECT, INSERT ON TABLE public.privacy_erasure_ledger TO demos_staging_runtime;
CREATE POLICY gdpr_fixture_users ON public.users
  FOR ALL TO demos_staging_runtime
  USING (id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid))
  WITH CHECK (id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid));
CREATE POLICY gdpr_fixture_user_consents ON public.user_consents
  FOR ALL TO demos_staging_runtime
  USING (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid))
  WITH CHECK (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid));
CREATE POLICY gdpr_fixture_opinioni_risposte ON public.opinioni_risposte
  FOR ALL TO demos_staging_runtime
  USING (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid))
  WITH CHECK (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid));
CREATE POLICY gdpr_fixture_political_selections ON public.political_selections
  FOR ALL TO demos_staging_runtime
  USING (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid))
  WITH CHECK (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid));
CREATE POLICY gdpr_fixture_user_representatives ON public.user_representatives
  FOR ALL TO demos_staging_runtime
  USING (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid))
  WITH CHECK (user_id IN ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid));
  CREATE POLICY gdpr_fixture_ledger_select ON public.privacy_erasure_ledger
    FOR SELECT TO demos_staging_runtime
    USING (subject_user_id IN ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302'));
  CREATE POLICY gdpr_fixture_ledger_insert ON public.privacy_erasure_ledger
    FOR INSERT TO demos_staging_runtime
    WITH CHECK (subject_user_id IN ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302'));
  -- Deterministic, invented fixtures only; no production data.
  INSERT INTO public.users(id,nome,ruolo,candidato_attivo,political_opinions_consent,energia_nucleare)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid,'Synthetic GDPR A','E',true,true,'f'),
           ('00000000-0000-4000-8000-000000000302'::uuid,'Synthetic GDPR B','E',false,true,NULL);
  INSERT INTO public.user_consents(user_id,political_opinions_consent)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid,true),('00000000-0000-4000-8000-000000000302'::uuid,true);
  INSERT INTO public.opinioni_risposte(user_id,energia_nucleare)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid,'f');
  INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid,'candidate'),
           ('00000000-0000-4000-8000-000000000302'::uuid,'00000000-0000-4000-8000-000000000301'::uuid,'representative');
  INSERT INTO public.user_representatives(user_id,rappresentante_camera,candidato_comune)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid,'00000000-0000-4000-8000-000000000302'::uuid,'00000000-0000-4000-8000-000000000302'::uuid);
  -- Verify security inside the same atomic statement; on failure all DDL rolls back.
  SELECT COUNT(*) INTO found FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND c.relforcerowsecurity
      AND c.relname=ANY(ARRAY['users','user_consents','opinioni_risposte','political_selections','user_representatives','privacy_erasure_ledger']);
  IF found <> 6 THEN RAISE EXCEPTION 'GDPR_STAGING_RLS_ASSERTION_FAILED'; END IF;
  SELECT COUNT(*) INTO exposed FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY(ARRAY['users','user_consents','opinioni_risposte','political_selections','user_representatives','privacy_erasure_ledger'])
      AND (
        EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) acl
           WHERE acl.grantee=0)
        OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute attr
           CROSS JOIN LATERAL pg_catalog.aclexplode(attr.attacl) acl
           WHERE attr.attrelid=c.oid AND attr.attnum>0
             AND NOT attr.attisdropped AND acl.grantee=0)
        OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles r
           WHERE r.rolname IN ('anon','authenticated','service_role')
             AND (pg_catalog.has_any_column_privilege(r.rolname,c.oid,'SELECT')
               OR pg_catalog.has_any_column_privilege(r.rolname,c.oid,'INSERT')
               OR pg_catalog.has_any_column_privilege(r.rolname,c.oid,'UPDATE')
               OR pg_catalog.has_table_privilege(r.rolname,c.oid,'DELETE')))
      );
  IF exposed <> 0 THEN RAISE EXCEPTION 'GDPR_STAGING_API_GRANTS_ASSERTION_FAILED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='demos_staging_runtime' AND rolcanlogin
      AND NOT rolbypassrls AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb)
    THEN RAISE EXCEPTION 'GDPR_STAGING_ROLE_ASSERTION_FAILED';
  END IF;
END
$gdpr_staging$;