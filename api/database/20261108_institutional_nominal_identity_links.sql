-- PROD-041. DRAFT ONLY; deploy solely after DPO/ops approval.
-- Minimal vetted identity bridge: one stable institutional source person ID
-- linked to one stable DEMOS representative UUID for a current institution.
-- This is NOT a nominal vote archive and has no vote, group or ballot fields.
BEGIN;
CREATE TABLE IF NOT EXISTS public.institutional_nominal_identity_links (
  institution text NOT NULL CHECK (institution IN ('Camera','Senato')),
  representative_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_person_id text NOT NULL CHECK (length(source_person_id) BETWEEN 12 AND 250),
  evidence_url text NOT NULL CHECK (evidence_url LIKE 'https://%'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution, representative_id),
  UNIQUE (institution, source_person_id)
);
ALTER TABLE public.institutional_nominal_identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institutional_nominal_identity_links FROM PUBLIC;
DO $prod041_links$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON public.institutional_nominal_identity_links FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON public.institutional_nominal_identity_links FROM authenticated;
  END IF;
END $prod041_links$;
COMMENT ON TABLE public.institutional_nominal_identity_links IS
  'Verified source-person to DEMOS ID mapping only; no names, parties or nominal vote history; no automatic name-based backfill';
-- Stage was previously created with source_person_id nullable. A verified
-- current row must have a source ID, never just a DEMOS UUID + matching name.
ALTER TABLE public.institutional_current_nominal_votes
  ALTER COLUMN source_person_id SET NOT NULL;
COMMIT;
