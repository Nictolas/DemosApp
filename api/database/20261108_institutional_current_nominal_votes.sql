-- PROD-041. DRAFT ONLY. Never run this migration automatically in production.
-- One CURRENT verified nominal vote per stable representative key across institutions.
-- There is no per-ballot nominal history, party field, or JSONB snapshot.
BEGIN;
CREATE TABLE IF NOT EXISTS public.institutional_current_nominal_votes (
  institution text NOT NULL CHECK (institution IN ('Camera', 'Senato', 'PE')),
  representative_key text NOT NULL CHECK (length(representative_key) BETWEEN 6 AND 180),
  source_person_id text,
  ballot_id text NOT NULL CHECK (length(ballot_id) BETWEEN 3 AND 200),
  vote_date date NOT NULL,
  ballot_order bigint NOT NULL CHECK (ballot_order >= 0),
  vote text NOT NULL CHECK (vote IN (
    'Favorevole', 'Contrario', 'Astensione', 'Astenuto', 'Astenuto R',
    'Assente', 'In missione', 'In congedo', 'Non ha partecipato',
    'Presente non votante', 'Presidente di turno'
  )),
  ballot_title text NOT NULL,
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  source_type text NOT NULL CHECK (source_type IN ('camera_ufficiale', 'senato_openpolis', 'pe_ufficiale')),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (representative_key)
);
ALTER TABLE public.institutional_current_nominal_votes ENABLE ROW LEVEL SECURITY;
-- Backend-only. No public Data API grants and no direct client-side access.
REVOKE ALL ON TABLE public.institutional_current_nominal_votes FROM PUBLIC;
-- Supabase defines anon/authenticated roles; standalone ephemeral CI PostgreSQL does not.
DO $prod041$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.institutional_current_nominal_votes FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.institutional_current_nominal_votes FROM authenticated;
  END IF;
END $prod041$;
COMMENT ON TABLE public.institutional_current_nominal_votes IS
  'PROD-041: one latest verifiable nominal roll-call per stable representative key; no historical nominal snapshots';
COMMIT;
