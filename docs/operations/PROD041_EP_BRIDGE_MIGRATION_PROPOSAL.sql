-- PROPOSAL ONLY for PR #633 / PROD-041. NOT a deployable migration.
-- Independent, explicitly approved operator must copy/adapt after DPO + staging GO.
-- The ownership of actual schema changes remains PR #633; #635 does not
-- execute this file against Supabase or create a second staging environment.
--
-- Original staging constraints verified 2026-11-08:
--   institutional_nominal_identity_links_institution_check
--   institutional_nominal_identity_links_source_person_id_check
-- Preserve 12..250 character person IDs for Camera/Senato.
-- For PE accept ONLY exact 1..9 digit decimal MepIds, no prefixes or names.
-- All identity links remain PENDING until an authorized independent review.
BEGIN;
DO $preflight$
DECLARE
  current_institution text;
  current_person text;
BEGIN
  IF to_regclass('public.institutional_nominal_identity_links') IS NULL THEN
    RAISE EXCEPTION 'PROD041_PE_BRIDGE_BASE_MIGRATION_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='institutional_nominal_identity_links'
      AND column_name='review_state'
  ) THEN
    RAISE EXCEPTION 'PROD041_PE_BRIDGE_REVIEW_GATE_MISSING';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO current_institution
  FROM pg_constraint
  WHERE conrelid='public.institutional_nominal_identity_links'::regclass
    AND conname='institutional_nominal_identity_links_institution_check';
  SELECT pg_get_constraintdef(oid) INTO current_person
  FROM pg_constraint
  WHERE conrelid='public.institutional_nominal_identity_links'::regclass
    AND conname='institutional_nominal_identity_links_source_person_id_check';
  -- Refuse unknown constraints rather than weakening safeguards owned
  -- by another migration; already-upgraded form is also checked below.
  IF current_institution IS NULL OR current_person IS NULL THEN
    RAISE EXCEPTION 'PROD041_PE_BRIDGE_CONSTRAINT_NAMES_UNEXPECTED';
  END IF;
  -- Exact original CHECK definitions, observed in unified staging.
  -- If any migration has already altered either constraint, refuse to
  -- overwrite it. The owner of #633 must reconcile that change first.
  IF current_institution <>
     'CHECK ((institution = ANY (ARRAY[''Camera''::text, ''Senato''::text])))'
     OR current_person <>
     'CHECK (((length(source_person_id) >= 12) AND (length(source_person_id) <= 250)))'
  THEN
    RAISE EXCEPTION 'PROD041_PE_BRIDGE_CONSTRAINT_DEFINITION_UNEXPECTED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.institutional_nominal_identity_links l
    WHERE NOT (
      (l.institution IN ('Camera','Senato')
       AND length(l.source_person_id) BETWEEN 12 AND 250)
      OR (l.institution='PE'
       AND l.source_person_id ~ '^[1-9][0-9]{0,8}$')
    )
  ) THEN
    RAISE EXCEPTION 'PROD041_PE_BRIDGE_EXISTING_PERSON_ID_OUTSIDE_ALLOWED_RULES';
  END IF;
END
$preflight$;
ALTER TABLE public.institutional_nominal_identity_links
  DROP CONSTRAINT institutional_nominal_identity_links_institution_check,
  DROP CONSTRAINT institutional_nominal_identity_links_source_person_id_check;
ALTER TABLE public.institutional_nominal_identity_links
  ADD CONSTRAINT institutional_nominal_identity_links_institution_check
    CHECK (institution IN ('Camera','Senato','PE')),
  ADD CONSTRAINT institutional_nominal_identity_links_source_person_id_check
    CHECK (
      (institution IN ('Camera','Senato')
       AND length(source_person_id) BETWEEN 12 AND 250)
      OR
      (institution='PE'
       AND source_person_id ~ '^[1-9][0-9]{0,8}$')
    );
COMMIT;
