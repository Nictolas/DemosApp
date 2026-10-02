-- Shadow-only Research projection. DO NOT apply to production without approved migration.
CREATE TABLE IF NOT EXISTS research_public_political_vectors (
  candidate_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('candidate', 'representative')),
  grade text NOT NULL CHECK (grade ~ '^[A-Z]{1,2}$'),
  country text,
  region text,
  province text,
  municipality text,
  display_name text NOT NULL,
  avatar_config jsonb,
  opinions jsonb NOT NULL CHECK (jsonb_typeof(opinions) = 'object'),
  source_snapshot_id text NOT NULL,
  methodology_version text NOT NULL,
  generated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (candidate_id, kind, grade, source_snapshot_id),
  CHECK (expires_at > generated_at),
  CHECK (expires_at <= generated_at + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS research_public_political_vectors_scope_idx
ON research_public_political_vectors (kind, grade, country, region, province, municipality, expires_at);

REVOKE ALL ON research_public_political_vectors FROM PUBLIC;
REVOKE ALL ON research_public_political_vectors FROM anon;
REVOKE ALL ON research_public_political_vectors FROM authenticated;
