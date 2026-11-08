-- PROD-041, Draft review gate, no automated person-link approvals.
-- Requires the base identity-link table. Safe to run twice on staging.
-- A newly inserted identity link is PENDING and NEVER authorizes nominal
-- attribution until a reviewer confirms exact institutional evidence.
BEGIN;
ALTER TABLE public.institutional_nominal_identity_links
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
DO $prod041_review_state$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.institutional_nominal_identity_links'::regclass
      AND conname='institutional_nominal_identity_links_review_gate_check'
  ) THEN
    ALTER TABLE public.institutional_nominal_identity_links
      ADD CONSTRAINT institutional_nominal_identity_links_review_gate_check
      CHECK (
        (review_state='PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (review_state='VERIFIED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
      );
  END IF;
END $prod041_review_state$;
COMMENT ON COLUMN public.institutional_nominal_identity_links.review_state IS
  'PENDING by default; VERIFIED only after independent institutional evidence review. Never auto-approve name/DOB candidates.';
COMMENT ON COLUMN public.institutional_nominal_identity_links.reviewed_by IS
  'Existing DEMOS user UUID of authorized manual reviewer; no added profile/contact fields.';
COMMIT;
