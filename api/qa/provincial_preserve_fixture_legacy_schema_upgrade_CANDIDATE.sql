-- DEMOS #627 — REVIEW-ONLY Demos-Staging schema candidate.
-- NEVER execute on production. NOT approved for connected Supabase execution.
-- This variant preserves up to two pre-existing GDPR synthetic legacy selections
-- without guessing a jurisdiction or office, or erasing them.
-- It refuses all rows outside the two known GDPR fixture owners.
-- Explicit session settings are accident guards, NOT proof of approval/project.
-- Keep the single existing staging service and all dispatch flags OFF.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
LOCK TABLE public.political_selections IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $guard$
DECLARE
  relation_oid oid := to_regclass('public.political_selections');
  current_columns name[];
  legacy_pk text;
  legacy_rows integer;
BEGIN
  IF current_setting('demos.provincial_ddl_approval', true)
      IS DISTINCT FROM 'reviewed-preserve-gdpr-fixtures-staging-only'
     OR current_setting('demos.staging_project_ref', true)
      IS DISTINCT FROM 'fkeayjzvtuvzesljhjbc'
  THEN
    RAISE EXCEPTION 'PROVINCIAL_DDL_NOT_APPROVED' USING ERRCODE = 'P0001';
  END IF;
  IF relation_oid IS NULL THEN
    RAISE EXCEPTION 'PROVINCIAL_LEGACY_RELATION_MISSING' USING ERRCODE = 'P0001';
  END IF;
  SELECT array_agg(a.attname ORDER BY a.attname) INTO current_columns
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = relation_oid AND a.attnum > 0 AND NOT a.attisdropped;
  IF current_columns IS DISTINCT FROM
      ARRAY['selected_user_id','selection_kind','user_id']::name[] THEN
    RAISE EXCEPTION 'PROVINCIAL_LEGACY_COLUMNS_CHANGED' USING ERRCODE = 'P0001';
  END IF;
  SELECT pg_catalog.pg_get_constraintdef(k.oid, true) INTO legacy_pk
  FROM pg_catalog.pg_constraint k
  WHERE k.conrelid = relation_oid
    AND k.conname = 'political_selections_pkey' AND k.contype = 'p';
  IF legacy_pk IS DISTINCT FROM
      'PRIMARY KEY (user_id, selected_user_id, selection_kind)' THEN
    RAISE EXCEPTION 'PROVINCIAL_LEGACY_PK_CHANGED' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint fk
    WHERE fk.contype = 'f' AND fk.confrelid = relation_oid
  ) THEN
    RAISE EXCEPTION 'PROVINCIAL_LEGACY_PK_REFERENCED' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = relation_oid AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'PROVINCIAL_LEGACY_TRIGGER_REVIEW_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=relation_oid) THEN
    RAISE EXCEPTION 'PROVINCIAL_LEGACY_RLS_DISABLED' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO legacy_rows FROM public.political_selections;
  IF legacy_rows > 2
      OR EXISTS (
        SELECT 1 FROM public.political_selections
        WHERE user_id NOT IN (
          '00000000-0000-4000-8000-000000000301'::uuid,
          '00000000-0000-4000-8000-000000000302'::uuid
        ) OR selected_user_id NOT IN (
          '00000000-0000-4000-8000-000000000301'::uuid,
          '00000000-0000-4000-8000-000000000302'::uuid
        )
      ) THEN
    RAISE EXCEPTION 'PROVINCIAL_NONFIXTURE_LEGACY_ROWS' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.political_selections
    WHERE selection_kind NOT IN ('candidate','representative')
  ) THEN
    RAISE EXCEPTION 'PROVINCIAL_UNKNOWN_LEGACY_SELECTION_KIND' USING ERRCODE = 'P0001';
  END IF;
END
$guard$;
-- Existing rows intentionally remain unmapped, with source=legacy_unmapped.
-- No office can be inferred from a legacy (user, subject, kind) triple.
ALTER TABLE public.political_selections
  ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN jurisdiction_id TEXT,
  ADD COLUMN political_office_id TEXT,
  ADD COLUMN selected_candidacy_id UUID,
  ADD COLUMN selected_mandate_id UUID,
  ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy_unmapped',
  ADD COLUMN context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.political_selections ALTER COLUMN source SET DEFAULT 'matching';
ALTER TABLE public.political_selections
  DROP CONSTRAINT political_selections_pkey,
  ADD CONSTRAINT political_selections_pkey PRIMARY KEY (id),
  ADD CONSTRAINT political_selections_kind_check
    CHECK (selection_kind IN ('candidate','representative')),
  ADD CONSTRAINT political_selections_target_relation_check
    CHECK (
      (selection_kind = 'candidate' AND selected_mandate_id IS NULL)
      OR (selection_kind = 'representative' AND selected_candidacy_id IS NULL)
    ),
  ADD CONSTRAINT political_selections_office_mapping_check
    CHECK (
      (source = 'legacy_unmapped'
        AND jurisdiction_id IS NULL AND political_office_id IS NULL)
      OR
      (source <> 'legacy_unmapped'
        AND jurisdiction_id IS NOT NULL AND political_office_id IS NOT NULL)
    );
CREATE UNIQUE INDEX uq_political_selections_user_kind_office
  ON public.political_selections(user_id,selection_kind,political_office_id);
CREATE INDEX idx_political_selections_selected_subject
  ON public.political_selections(selected_user_id,selection_kind,political_office_id);
CREATE INDEX idx_political_selections_jurisdiction_office
  ON public.political_selections(jurisdiction_id,political_office_id);
COMMIT;
