-- IMP-046: invalidate active political choices in the SAME transaction in
-- which a mandate or candidacy is ended/cancelled. This migration is NOT
-- retroactive; historical rows require a separate reviewed reconciliation.
-- Only the supported Italian offices are mapped; other political adapters
-- continue to use the API's capability-validation path.
BEGIN;

CREATE OR REPLACE FUNCTION public.invalidate_political_selections_on_end()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  office_id text;
  selected_kind text;
  legacy_field text;
  office_grade text;
  another_active_office boolean := false;
  removed_electors uuid[] := ARRAY[]::uuid[];
BEGIN
  IF OLD.status IS DISTINCT FROM 'ACTIVE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'ACTIVE' AND
     (NEW.ends_at IS NULL OR NEW.ends_at > CURRENT_TIMESTAMP) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'political_mandates' THEN
    selected_kind := 'representative';
    office_grade := upper(coalesce(NEW.office_code, ''));
  ELSIF TG_TABLE_NAME = 'political_candidacies' THEN
    selected_kind := 'candidate';
    office_grade := upper(coalesce(NEW.jurisdiction ->> 'level', ''));
  ELSE
    RETURN NEW;
  END IF;

  SELECT v.office_id, fields.field_name INTO office_id, legacy_field
  FROM (VALUES
    ('E',  'eu.parliament.it', 'rappresentante_europeo', 'candidato_europeo'),
    ('C',  'it.camera',        'rappresentante_camera',   'candidato_camera'),
    ('S',  'it.senato',        'rappresentante_senato',   'candidato_senato'),
    ('R',  'it.regional',      'rappresentante_regionale','candidato_regionale'),
    ('CO', 'it.municipal',     'rappresentante_comune',   'candidato_comune')
  ) AS v(grade, office_id, representative_field, candidate_field)
  CROSS JOIN LATERAL (
    SELECT CASE WHEN selected_kind = 'representative'
                THEN v.representative_field ELSE v.candidate_field END AS field_name
  ) fields
  WHERE v.grade = office_grade;

  -- A jurisdiction or office we do not recognize must never trigger broad
  -- deletion. Future adapters should add a separate explicit mapping.
  IF office_id IS NULL OR legacy_field IS NULL THEN
    RETURN NEW;
  END IF;

  -- If the person has a second active capability for the same office,
  -- keep unbound/legacy choices; only invalidate choices tied to this ID.
  IF selected_kind = 'representative' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.political_mandates other
      WHERE other.user_id = NEW.user_id AND other.id <> NEW.id
        AND other.office_code = NEW.office_code
        AND other.status = 'ACTIVE'
        AND (other.ends_at IS NULL OR other.ends_at > CURRENT_TIMESTAMP)
    ) INTO another_active_office;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.political_candidacies other
      WHERE other.user_id = NEW.user_id AND other.id <> NEW.id
        AND upper(coalesce(other.jurisdiction->>'level', '')) = office_grade
        AND other.status = 'ACTIVE'
        AND (other.ends_at IS NULL OR other.ends_at > CURRENT_TIMESTAMP)
    ) INTO another_active_office;
  END IF;

  IF selected_kind = 'representative' THEN
    WITH removed AS (
      DELETE FROM public.political_selections ps
      WHERE ps.selected_user_id = NEW.user_id
        AND ps.selection_kind = selected_kind
        AND ps.political_office_id = office_id
        AND (ps.selected_mandate_id = NEW.id
             OR (ps.selected_mandate_id IS NULL AND NOT another_active_office))
      RETURNING ps.user_id
    )
    SELECT coalesce(array_agg(user_id), ARRAY[]::uuid[])
    INTO removed_electors FROM removed;
  ELSE
    WITH removed AS (
      DELETE FROM public.political_selections ps
      WHERE ps.selected_user_id = NEW.user_id
        AND ps.selection_kind = selected_kind
        AND ps.political_office_id = office_id
        AND (ps.selected_candidacy_id = NEW.id
             OR (ps.selected_candidacy_id IS NULL AND NOT another_active_office))
      RETURNING ps.user_id
    )
    SELECT coalesce(array_agg(user_id), ARRAY[]::uuid[])
    INTO removed_electors FROM removed;
  END IF;

  -- Clear projections for electors whose specific stored capability ended.
  -- For legacy-only choices, where no capability ID is recorded, clear all
  -- references only if NO alternative same-office capability remains active.
  EXECUTE format(
    'UPDATE public.users SET %1$I = NULL, updated_at = NOW() ' ||
    'WHERE %1$I::text = $1 AND (NOT $3 OR id = ANY($2::uuid[]))',
    legacy_field
  ) USING NEW.user_id::text, removed_electors, another_active_office;

  IF to_regclass('public.user_representatives') IS NOT NULL THEN
    EXECUTE format(
      'UPDATE public.user_representatives SET %1$I = NULL, updated_at = NOW() ' ||
      'WHERE %1$I::text = $1 AND (NOT $3 OR user_id = ANY($2::uuid[]))',
      legacy_field
    ) USING NEW.user_id::text, removed_electors, another_active_office;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS political_mandate_selection_invalidation ON public.political_mandates;
CREATE TRIGGER political_mandate_selection_invalidation
AFTER UPDATE OF status, ends_at ON public.political_mandates
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.ends_at IS DISTINCT FROM NEW.ends_at)
EXECUTE FUNCTION public.invalidate_political_selections_on_end();

DROP TRIGGER IF EXISTS political_candidacy_selection_invalidation ON public.political_candidacies;
CREATE TRIGGER political_candidacy_selection_invalidation
AFTER UPDATE OF status, ends_at ON public.political_candidacies
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.ends_at IS DISTINCT FROM NEW.ends_at)
EXECUTE FUNCTION public.invalidate_political_selections_on_end();

COMMIT;
