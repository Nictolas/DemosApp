-- DEMOS civic notification staged-runtime permissions. STAGING ONLY, NEVER PROD.
-- Synthetic staging login is permitted access only to test civic tables.
-- No anon/authenticated permissions; no real tokens or pushes.
-- Execute atomically only in the selected isolated Demos-Staging project:
-- BEGIN;
-- SET LOCAL civic.runtime_access_environment = 'staging';
-- SET LOCAL civic.runtime_access_approval = 'I_APPROVE_CIVIC_STAGING_RUNTIME_ACCESS';
-- [paste file]
-- COMMIT;
DO $civic_stage_guard$
DECLARE
  expected_users CONSTANT UUID[] := ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ];
BEGIN
  IF current_setting('civic.runtime_access_environment', TRUE) IS DISTINCT FROM 'staging'
    OR current_setting('civic.runtime_access_approval', TRUE)
       IS DISTINCT FROM 'I_APPROVE_CIVIC_STAGING_RUNTIME_ACCESS' THEN
    RAISE EXCEPTION 'CIVIC_STAGING_RUNTIME_EXPLICIT_APPROVAL_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'demos_staging_runtime' AND rolcanlogin
      AND NOT rolbypassrls AND NOT rolsuper
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_RUNTIME_ROLE_INVALID';
  END IF;

  IF (SELECT COUNT(*) FROM public.users) <> 2
     OR EXISTS (
       SELECT 1 FROM public.users
       WHERE NOT (id = ANY(expected_users)) OR status IS DISTINCT FROM 'pending'
     )
     OR EXISTS (SELECT 1 FROM public.user_devices)
  THEN
    RAISE EXCEPTION 'CIVIC_STAGING_RUNTIME_SYNTHETIC_ACCOUNTS_REQUIRED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.eci)
     OR EXISTS (SELECT 1 FROM public.iniziative_ministero)
     OR EXISTS (SELECT 1 FROM public.notifiche_preferenze)
     OR EXISTS (SELECT 1 FROM public.civic_new_initiative_notifications)
     OR NOT EXISTS (
       SELECT 1 FROM public.civic_push_delivery_guard
       WHERE id=1 AND blocked=TRUE AND reason_code='ROLLOUT_NOT_APPROVED'
     )
     OR (SELECT COUNT(*) FROM public.civic_runtime_identity) <> 1
  THEN
    RAISE EXCEPTION 'CIVIC_STAGING_RUNTIME_BASELINE_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      VALUES ('eci'), ('iniziative_ministero'), ('notifiche_preferenze'),
        ('user_devices'), ('civic_new_initiative_notifications'),
        ('civic_push_delivery_guard'), ('civic_runtime_identity'), ('users')
    ) AS required(name)
    LEFT JOIN pg_class c
      ON c.oid = to_regclass(format('public.%I',required.name))
    WHERE c.oid IS NULL OR NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_RUNTIME_RLS_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename IN (
      'eci','iniziative_ministero','notifiche_preferenze',
      'civic_new_initiative_notifications','civic_push_delivery_guard',
      'civic_runtime_identity'
    )
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_RUNTIME_POLICIES_ALREADY_PRESENT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_roles r ON r.rolname IN ('anon','authenticated')
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ('eci','iniziative_ministero','notifiche_preferenze',
          'civic_new_initiative_notifications','civic_push_delivery_guard',
          'civic_runtime_identity')
      AND (has_table_privilege(r.oid,c.oid,'SELECT')
        OR has_table_privilege(r.oid,c.oid,'INSERT')
        OR has_table_privilege(r.oid,c.oid,'UPDATE')
        OR has_table_privilege(r.oid,c.oid,'DELETE'))
  ) THEN
    RAISE EXCEPTION 'CIVIC_STAGING_RUNTIME_CLIENT_ROLE_EXPOSED';
  END IF;
END
$civic_stage_guard$;

-- Only this named synthetic staging LOGIN can exercise these backend tables.
GRANT SELECT, INSERT, UPDATE ON public.eci, public.iniziative_ministero
  TO demos_staging_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifiche_preferenze
  TO demos_staging_runtime;
GRANT SELECT, INSERT, UPDATE ON public.civic_new_initiative_notifications
  TO demos_staging_runtime;
GRANT SELECT, UPDATE ON public.civic_push_delivery_guard
  TO demos_staging_runtime;
GRANT SELECT ON public.civic_runtime_identity TO demos_staging_runtime;
GRANT USAGE ON SEQUENCE public.civic_new_initiative_notifications_id_seq
  TO demos_staging_runtime;

CREATE POLICY civic_stage_runtime_eci ON public.eci
  FOR ALL TO demos_staging_runtime
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY civic_stage_runtime_ministero ON public.iniziative_ministero
  FOR ALL TO demos_staging_runtime
  USING (TRUE) WITH CHECK (TRUE);

-- Never authorize preference access to any other synthetic user ID.
CREATE POLICY civic_stage_runtime_preferences ON public.notifiche_preferenze
  FOR ALL TO demos_staging_runtime
  USING (user_id = ANY(ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ]))
  WITH CHECK (user_id = ANY(ARRAY[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ]));

CREATE POLICY civic_stage_runtime_outbox ON public.civic_new_initiative_notifications
  FOR ALL TO demos_staging_runtime
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY civic_stage_runtime_guard_read ON public.civic_push_delivery_guard
  FOR SELECT TO demos_staging_runtime USING (TRUE);

-- The backend can only make the emergency barrier MORE restrictive, never
-- authorize outgoing push (blocked=FALSE is deliberately denied in staging).
CREATE POLICY civic_stage_runtime_guard_stop ON public.civic_push_delivery_guard
  FOR UPDATE TO demos_staging_runtime
  USING (TRUE) WITH CHECK (blocked IS TRUE);
CREATE POLICY civic_stage_runtime_identity_read ON public.civic_runtime_identity
  FOR SELECT TO demos_staging_runtime USING (TRUE);

-- No users or user_devices GRANT/POLICY changes: their existing GDPR synthetic
-- account restrictions are preserved.
