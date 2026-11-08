#!/usr/bin/env bash
set -euo pipefail
# CI-only disposable PostgreSQL 16, NEVER DEMOS staging/production.
test "$EP_SCHEMA_FIXTURE_ONLY" = "true" || { echo EP_SCHEMA_FIXTURE_ONLY_REQUIRED >&2; exit 1; }
test "$PGDATABASE" = "ep_bridge_ci_fixture" || { echo EP_SCHEMA_FIXTURE_DB_NAME_REQUIRED >&2; exit 1; }
case "$PGHOST" in localhost|127.0.0.1) ;; *) echo EP_SCHEMA_LOCAL_POSTGRES_ONLY >&2; exit 1;; esac
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE public.users (id uuid PRIMARY KEY);
INSERT INTO public.users(id) VALUES
 ('00000000-0000-4000-8000-000000000101'),
 ('00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000103'),
 ('00000000-0000-4000-8000-000000000104');
CREATE TABLE public.institutional_nominal_identity_links (
  institution text NOT NULL CHECK (institution IN ('Camera','Senato')),
  representative_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_person_id text NOT NULL CHECK (length(source_person_id) BETWEEN 12 AND 250),
  evidence_url text NOT NULL CHECK (evidence_url LIKE 'https://%'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  review_state text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  CONSTRAINT institutional_nominal_identity_links_review_gate_check
    CHECK (
      (review_state='PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (review_state='VERIFIED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
  PRIMARY KEY (institution, representative_id),
  UNIQUE (institution, source_person_id)
);
ALTER TABLE public.institutional_nominal_identity_links ENABLE ROW LEVEL SECURITY;
INSERT INTO public.institutional_nominal_identity_links (
  institution, representative_id,source_person_id,evidence_url
) VALUES
 ('Camera','00000000-0000-4000-8000-000000000101','CAMERA-ID-001',
  'https://example.invalid/source-camera'),
 ('Senato','00000000-0000-4000-8000-000000000102','SENATE-ID-001',
  'https://example.invalid/source-senato');
SQL
psql -X -v ON_ERROR_STOP=1 -q -f docs/operations/PROD041_EP_BRIDGE_MIGRATION_PROPOSAL.sql
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $assert$
DECLARE prior_count integer; rls boolean;
BEGIN
  SELECT COUNT(*) INTO prior_count
    FROM public.institutional_nominal_identity_links
    WHERE institution IN ('Camera','Senato')
      AND source_person_id IN ('CAMERA-ID-001','SENATE-ID-001')
      AND review_state='PENDING' AND reviewed_by IS NULL;
  IF prior_count<>2 THEN RAISE EXCEPTION 'EP_BRIDGE_PG_LOST_EXISTING_CHAMBER_LINKS'; END IF;
  SELECT relrowsecurity INTO rls FROM pg_class
    WHERE oid='public.institutional_nominal_identity_links'::regclass;
  IF rls IS DISTINCT FROM true THEN RAISE EXCEPTION 'EP_BRIDGE_PG_RLS_REMOVED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.institutional_nominal_identity_links'::regclass
      AND conname='institutional_nominal_identity_links_institution_check'
      AND pg_get_constraintdef(oid) LIKE '%PE%'
  ) THEN RAISE EXCEPTION 'EP_BRIDGE_PG_PE_NOT_ADDED'; END IF;
END
$assert$;
INSERT INTO public.institutional_nominal_identity_links (
  institution,representative_id,source_person_id,evidence_url
) VALUES ('PE','00000000-0000-4000-8000-000000000103','234567',
          'https://data.europarl.europa.eu/person/234567');
DO $assert$
DECLARE pending_count integer;
BEGIN
  SELECT COUNT(*) INTO pending_count FROM public.institutional_nominal_identity_links
    WHERE institution='PE' AND source_person_id='234567'
      AND review_state='PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL;
  IF pending_count <> 1 THEN RAISE EXCEPTION 'EP_BRIDGE_PG_LINK_PREAPPROVED'; END IF;
END
$assert$;
DO $reject$
DECLARE bad text;
BEGIN
  FOREACH bad IN ARRAY ARRAY['pe:234567','000001','1234567890','abc',
                             '234567 ','person/234567',''] LOOP
    BEGIN
      INSERT INTO public.institutional_nominal_identity_links(
        institution,representative_id,source_person_id,evidence_url
      ) VALUES ('PE','00000000-0000-4000-8000-000000000104',bad,
                'https://data.europarl.europa.eu/person/234567');
      RAISE EXCEPTION 'EP_BRIDGE_PG_ACCEPTED_BAD_MEP_ID';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    INSERT INTO public.institutional_nominal_identity_links(
      institution,representative_id,source_person_id,evidence_url
    ) VALUES ('Camera','00000000-0000-4000-8000-000000000104','123',
              'https://example.invalid/source');
    RAISE EXCEPTION 'EP_BRIDGE_PG_LOST_ORIGINAL_CHAMBER_MIN_LENGTH';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.institutional_nominal_identity_links(
      institution,representative_id,source_person_id,evidence_url,review_state
    ) VALUES ('PE','00000000-0000-4000-8000-000000000104','98765',
              'https://data.europarl.europa.eu/person/98765','VERIFIED');
    RAISE EXCEPTION 'EP_BRIDGE_PG_APPROVED_WITHOUT_REVIEWER';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$reject$;
SQL
echo "EP_BRIDGE_PROPOSAL_PG16_SYNTHETIC_PASS"
