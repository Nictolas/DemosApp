-- DEMOS POL-014 / POL-015. MANUAL migration for disposable PostgreSQL integration tests.
-- NOT included in production startup/migrations. Do not execute on production.
-- Sources and identity evidence must be approved independently before calling the function.
BEGIN;

CREATE SCHEMA IF NOT EXISTS demos_internal;
REVOKE ALL ON SCHEMA demos_internal FROM PUBLIC;

CREATE TABLE IF NOT EXISTS demos_internal.official_political_identities (
  institution TEXT NOT NULL CHECK (institution IN ('CAMERA', 'SENATO')),
  official_id TEXT NOT NULL CHECK (official_id ~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$'),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  source_url TEXT NOT NULL,
  review_reference TEXT NOT NULL CHECK (length(btrim(review_reference)) BETWEEN 8 AND 120),
  reviewed_by TEXT NOT NULL CHECK (length(btrim(reviewed_by)) BETWEEN 3 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution, official_id)
);
CREATE INDEX IF NOT EXISTS official_political_identities_user_idx
  ON demos_internal.official_political_identities(user_id);

CREATE TABLE IF NOT EXISTS demos_internal.official_political_mandate_links (
  institution TEXT NOT NULL,
  official_id TEXT NOT NULL,
  legislature INTEGER NOT NULL CHECK (legislature BETWEEN 1 AND 100),
  starts_on DATE NOT NULL,
  ends_on DATE NULL,
  mandate_id UUID NOT NULL UNIQUE REFERENCES public.political_mandates(id) ON DELETE RESTRICT,
  source_url TEXT NOT NULL,
  review_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution, official_id, legislature, starts_on),
  FOREIGN KEY (institution, official_id)
    REFERENCES demos_internal.official_political_identities(institution, official_id)
    ON DELETE RESTRICT,
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

-- No public Data API exposure or implicit rights, even if future schema exposure changes.
ALTER TABLE demos_internal.official_political_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE demos_internal.official_political_mandate_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demos_internal.official_political_identities FROM PUBLIC;
REVOKE ALL ON demos_internal.official_political_mandate_links FROM PUBLIC;

CREATE OR REPLACE FUNCTION demos_internal.import_official_political_mandate(
  p_user_id UUID,
  p_institution TEXT,
  p_official_id TEXT,
  p_legislature INTEGER,
  p_starts_on DATE,
  p_ends_on DATE,
  p_source_url TEXT,
  p_review_reference TEXT,
  p_reviewed_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_user UUID;
  v_office TEXT;
  v_existing_identity UUID;
  v_existing_link demos_internal.official_political_mandate_links%ROWTYPE;
  v_mandate_id UUID;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_status TEXT;
  v_key TEXT;
BEGIN
  IF p_institution NOT IN ('CAMERA', 'SENATO') OR p_institution IS NULL THEN
    RAISE EXCEPTION 'INVALID_INSTITUTION';
  END IF;
  IF p_official_id IS NULL OR p_official_id !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$' THEN
    RAISE EXCEPTION 'INVALID_OFFICIAL_ID';
  END IF;
  IF p_legislature IS NULL OR p_legislature NOT BETWEEN 1 AND 100 OR
     p_starts_on IS NULL OR p_starts_on > CURRENT_DATE OR
     (p_ends_on IS NOT NULL AND p_ends_on < p_starts_on) THEN
    RAISE EXCEPTION 'INVALID_MANDATE_DATES';
  END IF;
  IF p_review_reference IS NULL OR length(btrim(p_review_reference)) NOT BETWEEN 8 AND 120 OR
     p_reviewed_by IS NULL OR length(btrim(p_reviewed_by)) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'MANUAL_REVIEW_REFERENCE_REQUIRED';
  END IF;
  -- This validates a host string only; no claims of fetching or verifying URL content.
  IF p_source_url IS NULL OR NOT (
      (p_institution = 'CAMERA' AND p_source_url ~ '^https://(www|dati)\.camera\.it/[^[:space:]#]+$') OR
      (p_institution = 'SENATO' AND p_source_url ~ '^https://(www|dati)\.senato\.it/[^[:space:]#]+$')
  ) THEN
    RAISE EXCEPTION 'INVALID_INSTITUTIONAL_SOURCE';
  END IF;

  v_office := CASE p_institution WHEN 'CAMERA' THEN 'C' ELSE 'S' END;
  v_start := p_starts_on::timestamp AT TIME ZONE 'UTC';
  -- Official ends_on is an inclusive calendar date; ends_at is exclusive at 00:00 UTC next day.
  v_end := CASE WHEN p_ends_on IS NULL THEN NULL
                ELSE (p_ends_on + 1)::timestamp AT TIME ZONE 'UTC' END;
  v_status := CASE WHEN p_ends_on IS NOT NULL AND p_ends_on < CURRENT_DATE
                   THEN 'ENDED' ELSE 'ACTIVE' END;
  v_key := p_institution || ':' || p_official_id;

  -- Serializes simultaneous attempts to map the same institutional identity.
  PERFORM pg_advisory_xact_lock(hashtextextended('demos/political/' || v_key, 0));

  SELECT u.id INTO v_user FROM public.users u
  WHERE u.id = p_user_id AND u.account_type = 'PERSON' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANONICAL_PERSON_USER_NOT_FOUND';
  END IF;

  SELECT i.user_id INTO v_existing_identity
  FROM demos_internal.official_political_identities i
  WHERE i.institution = p_institution AND i.official_id = p_official_id FOR UPDATE;
  IF FOUND AND v_existing_identity <> p_user_id THEN
    RAISE EXCEPTION 'OFFICIAL_IDENTITY_ALREADY_MAPPED_TO_DIFFERENT_USER';
  END IF;

  SELECT * INTO v_existing_link
  FROM demos_internal.official_political_mandate_links m
  WHERE m.institution = p_institution AND m.official_id = p_official_id
    AND m.legislature = p_legislature AND m.starts_on = p_starts_on
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_link.ends_on IS DISTINCT FROM p_ends_on OR
       v_existing_link.source_url IS DISTINCT FROM p_source_url OR
       v_existing_link.review_reference IS DISTINCT FROM p_review_reference OR
       NOT EXISTS (
         SELECT 1 FROM public.political_mandates pm
         WHERE pm.id = v_existing_link.mandate_id AND pm.user_id = p_user_id
           AND pm.source = 'OFFICIAL_VERIFIED'
           AND pm.office_code = v_office
           AND pm.starts_at = v_start
           AND pm.ends_at IS NOT DISTINCT FROM v_end
       )
    THEN
      RAISE EXCEPTION 'VERIFIED_MANDATE_CONFLICT_REQUIRES_REVIEW';
    END IF;
    RETURN jsonb_build_object('outcome','unchanged','mandate_id',v_existing_link.mandate_id);
  END IF;

  -- No self-certification of simultaneous active offices across the two chambers.
  -- Legacy backfill rows are excluded: known not to be verified mandates.
  IF EXISTS (
    SELECT 1 FROM public.political_mandates pm
    WHERE pm.user_id = p_user_id
      AND pm.office_code IN ('C', 'S') AND pm.office_code <> v_office
      AND pm.source <> 'LEGACY_BACKFILL'
      AND pm.status <> 'CANCELLED'
      AND pm.starts_at < COALESCE(v_end, 'infinity'::timestamptz)
      AND v_start < COALESCE(pm.ends_at, 'infinity'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'VERIFIED_CAMERA_SENATO_PERIOD_OVERLAP';
  END IF;

  INSERT INTO demos_internal.official_political_identities
    (institution, official_id, user_id, source_url, review_reference, reviewed_by)
  VALUES
    (p_institution, p_official_id, p_user_id, p_source_url, p_review_reference, p_reviewed_by)
  ON CONFLICT (institution, official_id) DO NOTHING;

  INSERT INTO public.political_mandates
    (user_id, office_code, institution_code, status, starts_at, ends_at,
     source, jurisdiction, legacy_context)
  VALUES (
    p_user_id, v_office, p_institution, v_status, v_start, v_end,
    'OFFICIAL_VERIFIED', '{}'::jsonb,
    jsonb_build_object('official_id', p_official_id, 'legislature', p_legislature,
                       'source_url', p_source_url, 'review_reference', p_review_reference)
  ) RETURNING id INTO v_mandate_id;

  INSERT INTO demos_internal.official_political_mandate_links
    (institution, official_id, legislature, starts_on, ends_on, mandate_id,
     source_url, review_reference)
  VALUES
    (p_institution, p_official_id, p_legislature, p_starts_on, p_ends_on,
     v_mandate_id, p_source_url, p_review_reference);

  RETURN jsonb_build_object('outcome','inserted','mandate_id',v_mandate_id);
END;
$fn$;

-- PostgreSQL grants EXECUTE to PUBLIC by default on newly created functions.
REVOKE ALL ON FUNCTION demos_internal.import_official_political_mandate(
  UUID, TEXT, TEXT, INTEGER, DATE, DATE, TEXT, TEXT, TEXT
) FROM PUBLIC;

COMMIT;
