-- DEMOS GDPR isolated synthetic staging fixture parity (2026-11-02).
-- Applied to Supabase project Demos-Staging fkeayjzvtuvzesljhjbc
-- as migration 20261102152437. NEVER point this at Demos production.
-- This guarded SQL requires exactly the two existing synthetic users;
-- never use this file as a production migration or on actual accounts.
-- New objects have FORCE RLS; no direct Data API grants; no FCM sends.

DO $guard$
BEGIN
  IF to_regclass('public.user_rights_requests') IS NOT NULL
     OR to_regclass('public.user_devices') IS NOT NULL THEN
    RAISE EXCEPTION 'STAGING_SCHEMA_ALREADY_EXISTS_STOP';
  END IF;
  IF (SELECT count(*) FROM public.users) <> 2
     OR (SELECT count(*) FROM public.users WHERE id IN
       ('00000000-0000-4000-8000-000000000301'::uuid,
        '00000000-0000-4000-8000-000000000302'::uuid)) <> 2 THEN
    RAISE EXCEPTION 'STAGING_ONLY_TWO_SYNTHETIC_USERS_REQUIRED';
  END IF;
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity
          FROM pg_class WHERE oid='public.users'::regclass) THEN
    RAISE EXCEPTION 'STAGING_USERS_FORCE_RLS_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
        AND tablename='users' AND policyname='gdpr_fixture_users') THEN
    RAISE EXCEPTION 'STAGING_FIXTURE_POLICY_REQUIRED';
  END IF;
  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname='demos_staging_runtime') IS DISTINCT FROM false
     OR (SELECT rolbypassrls FROM pg_roles WHERE rolname='demos_staging_b2_worker') IS DISTINCT FROM false
     OR pg_has_role('demos_staging_runtime','postgres','MEMBER') THEN
    RAISE EXCEPTION 'STAGING_LEAST_PRIVILEGED_ROLES_REQUIRED';
  END IF;
END $guard$;

CREATE TABLE public.user_rights_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  request_type varchar(50) NOT NULL,
  status varchar(20) DEFAULT 'pending',
  request_data jsonb DEFAULT '{}'::jsonb,
  response_data jsonb DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  processed_by varchar(255),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_request_type CHECK (request_type IN
    ('data_export','data_rectification','data_erasure','data_portability',
     'object_processing','limit_processing')),
  CONSTRAINT valid_status CHECK (status IN
    ('pending','processing','completed','rejected','cancelled'))
);
CREATE TABLE public.user_devices (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fcm_token text NOT NULL CONSTRAINT uq_user_devices_fcm_token UNIQUE,
  platform text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_devices_user_active
  ON public.user_devices(user_id, is_active);

ALTER TABLE public.user_rights_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rights_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.user_rights_requests, public.user_devices
  FROM PUBLIC, anon, authenticated, service_role, demos_staging_b2_worker;
REVOKE ALL PRIVILEGES ON SEQUENCE public.user_devices_id_seq
  FROM PUBLIC, anon, authenticated, service_role, demos_staging_b2_worker;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_rights_requests, public.user_devices TO demos_staging_runtime;
GRANT USAGE, SELECT ON SEQUENCE public.user_devices_id_seq
  TO demos_staging_runtime;

CREATE POLICY gdpr_fixture_rights_requests ON public.user_rights_requests
  FOR ALL TO demos_staging_runtime
  USING (user_id IN ('00000000-0000-4000-8000-000000000301',
                     '00000000-0000-4000-8000-000000000302'))
  WITH CHECK (user_id IN ('00000000-0000-4000-8000-000000000301',
                          '00000000-0000-4000-8000-000000000302'));
CREATE POLICY gdpr_fixture_user_devices ON public.user_devices
  FOR ALL TO demos_staging_runtime
  USING (user_id IN
    ('00000000-0000-4000-8000-000000000301'::uuid,
     '00000000-0000-4000-8000-000000000302'::uuid))
  WITH CHECK (user_id IN
    ('00000000-0000-4000-8000-000000000301'::uuid,
     '00000000-0000-4000-8000-000000000302'::uuid));

COMMENT ON TABLE public.user_rights_requests IS
 'STAGING FIXTURE ONLY: synthetic GDPR request rows; no real user data';
COMMENT ON TABLE public.user_devices IS
 'STAGING FIXTURE ONLY: synthetic FCM token rows; never send push';
