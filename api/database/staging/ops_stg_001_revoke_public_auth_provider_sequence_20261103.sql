-- OPS-STG-001: one-sequence, staging-only security hardening; NEVER production.
-- Run in ONE operator-approved transaction (outside this file):
-- BEGIN; SET LOCAL civic.sequence_revoke_approval='I_APPROVE_STAGING_SEQUENCE_REVOKE';
-- [the statements below]; COMMIT;
-- A failed guard/postcheck rolls back without touching any data rows.
DO $sequence_revoke_guard$
BEGIN
  IF current_setting('civic.sequence_revoke_approval',true)
    IS DISTINCT FROM 'I_APPROVE_STAGING_SEQUENCE_REVOKE' THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_APPROVAL_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM public.civic_runtime_identity WHERE id=1
      AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_WRONG_DATABASE';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard
      WHERE id=1 AND blocked IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_DELIVERY_UNBLOCKED';
  END IF;
  IF (SELECT count(*) FROM public.users) <> 2 OR EXISTS (
    SELECT 1 FROM public.users WHERE id NOT IN (
      '00000000-0000-4000-8000-000000000301'::uuid,
      '00000000-0000-4000-8000-000000000302'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_NON_SYNTHETIC_USERS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='user_auth_providers_id_seq'
      AND c.relkind='S'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid='public.user_auth_providers'::regclass AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_SCHEMA_UNEXPECTED';
  END IF;
  IF has_table_privilege('anon','public.user_auth_providers','SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','public.user_auth_providers','SELECT,INSERT,UPDATE,DELETE')
     OR has_any_column_privilege('anon','public.user_auth_providers','SELECT,INSERT,UPDATE,REFERENCES')
     OR has_any_column_privilege('authenticated','public.user_auth_providers','SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_TABLE_PUBLICLY_ACCESSIBLE';
  END IF;
  IF NOT (
    has_sequence_privilege('anon','public.user_auth_providers_id_seq','USAGE,UPDATE')
    AND has_sequence_privilege('authenticated','public.user_auth_providers_id_seq','USAGE,UPDATE')
  ) THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_UNEXPECTED_EXISTING_GRANTS';
  END IF;
END
$sequence_revoke_guard$;

REVOKE ALL PRIVILEGES ON SEQUENCE public.user_auth_providers_id_seq
  FROM PUBLIC, anon, authenticated;

DO $sequence_revoke_postcheck$
BEGIN
  IF has_sequence_privilege('anon','public.user_auth_providers_id_seq','SELECT,USAGE,UPDATE')
     OR has_sequence_privilege('authenticated','public.user_auth_providers_id_seq','SELECT,USAGE,UPDATE') THEN
    RAISE EXCEPTION 'STAGING_SEQUENCE_REVOKE_INCOMPLETE';
  END IF;
END
$sequence_revoke_postcheck$;
