-- CIE public-name provenance; additive migration, no existing personal data overwritten.
-- Apply before deploying the API which references this field.
BEGIN;
ALTER TABLE public.riconoscimenti
  ADD COLUMN IF NOT EXISTS cie_names_verified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_riconoscimenti_cie_name_provenance
  ON public.riconoscimenti(cie_names_verified_at)
  WHERE status = 'pending' AND cie_names_verified_at IS NOT NULL;
COMMIT;
