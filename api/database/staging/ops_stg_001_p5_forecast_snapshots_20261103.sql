-- OPS-STG-001 P5. Add one EMPTY aggregate referendum snapshot table to Demos-Staging.
-- Mirrors the production 20261017_referendum_forecast_snapshots.sql schema
-- (9 columns, 7 constraints, 2 indexes), with explicit fail-closed guards.
-- No user_id, no personal data, no grants to runtime or public clients.
BEGIN;
SET LOCAL search_path=public,pg_catalog;
DO $p5_guard$
BEGIN
  IF (SELECT count(*) FROM public.civic_runtime_identity
      WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'OPS_STG_P5_WRONG_DATABASE';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard
      WHERE id=1 AND blocked IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'OPS_STG_P5_DELIVERY_NOT_BLOCKED';
  END IF;
  IF to_regclass('public.civic_ballots') IS NULL THEN
    RAISE EXCEPTION 'OPS_STG_P5_MISSING_BALLOT_PREREQUISITE';
  END IF;
  IF to_regclass('public.civic_ballot_forecast_snapshots') IS NOT NULL
     OR to_regclass('public.idx_civic_ballot_forecast_snapshots_ballot_time') IS NOT NULL THEN
    RAISE EXCEPTION 'OPS_STG_P5_ALREADY_EXISTS';
  END IF;
END
$p5_guard$;

CREATE TABLE public.civic_ballot_forecast_snapshots (
  civic_ballot_id uuid NOT NULL,
  bucket_start timestamptz NOT NULL,
  total_responses integer NOT NULL,
  yes_count integer NOT NULL,
  no_count integer NOT NULL,
  abstain_count integer NOT NULL,
  is_frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.civic_ballot_forecast_snapshots
  ADD CONSTRAINT civic_ballot_forecast_snapshots_pkey
  PRIMARY KEY (civic_ballot_id, bucket_start);
ALTER TABLE public.civic_ballot_forecast_snapshots
  ADD CONSTRAINT civic_ballot_forecast_snapshots_total_responses_check
  CHECK (total_responses >= 0);
ALTER TABLE public.civic_ballot_forecast_snapshots
  ADD CONSTRAINT civic_ballot_forecast_snapshots_yes_count_check
  CHECK (yes_count >= 0);
ALTER TABLE public.civic_ballot_forecast_snapshots
  ADD CONSTRAINT civic_ballot_forecast_snapshots_no_count_check
  CHECK (no_count >= 0);
ALTER TABLE public.civic_ballot_forecast_snapshots
  ADD CONSTRAINT civic_ballot_forecast_snapshots_abstain_count_check
  CHECK (abstain_count >= 0);
ALTER TABLE public.civic_ballot_forecast_snapshots
  ADD CONSTRAINT civic_ballot_forecast_snapshots_check
  CHECK (yes_count + no_count + abstain_count = total_responses);
ALTER TABLE public.civic_ballot_forecast_snapshots
  ADD CONSTRAINT civic_ballot_forecast_snapshots_civic_ballot_id_fkey
  FOREIGN KEY (civic_ballot_id) REFERENCES public.civic_ballots(id)
  ON DELETE CASCADE;
CREATE INDEX idx_civic_ballot_forecast_snapshots_ballot_time
  ON public.civic_ballot_forecast_snapshots(civic_ballot_id,bucket_start DESC);
ALTER TABLE public.civic_ballot_forecast_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.civic_ballot_forecast_snapshots
  FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.civic_ballot_forecast_snapshots IS
  'Aggregated DEMOS referendum forecast snapshots. No user identifiers or individual vote history.';
COMMIT;
