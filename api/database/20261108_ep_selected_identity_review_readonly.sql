-- DEMOS PROD-041 / PE: restricted identity review (READ ONLY).
-- Source of truth: canonical political_selections office 'eu.parliament.it'.
-- Legacy text selections appear ONLY to diagnose unconverted references;
-- they do not grant eligibility for nominal-vote attribution.
-- Works in production and existing shared staging without needing the
-- legacy representative_europeo column (to_jsonb returns NULL there).
-- Reviewer-only: do not expose on public endpoints or export follower IDs,
-- DOB, private votes, party/group affiliations, or guessed MepIds.
-- NEVER UPDATE/INSERT/MERGE or automatically mark a match VERIFIED.
WITH canonical_active AS (
  SELECT ps.selected_user_id AS rep_uuid,
         COUNT(*)::integer AS canonical_active_selection_count
  FROM public.political_selections AS ps
  JOIN public.users AS follower ON follower.id=ps.user_id
                              AND follower.status='a'
  WHERE ps.selection_kind='representative'
    AND ps.political_office_id='eu.parliament.it'
    AND ps.selected_user_id IS NOT NULL
  GROUP BY ps.selected_user_id
),
legacy_active AS (
  SELECT NULLIF(trim(to_jsonb(r)->>'rappresentante_europeo'),'')
            AS raw_selection
  FROM public.user_representatives AS r
  WHERE EXISTS (
    SELECT 1 FROM public.users AS follower
    WHERE follower.id=r.user_id AND follower.status='a'
  )
),
legacy_classified AS (
  SELECT raw_selection,
         CASE WHEN raw_selection ~*
             '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           THEN raw_selection::uuid ELSE NULL::uuid
         END AS potential_uuid
  FROM legacy_active
  WHERE raw_selection IS NOT NULL
),
legacy_grouped AS (
  SELECT raw_selection,potential_uuid,
         COUNT(*)::integer AS legacy_active_selection_count
  FROM legacy_classified
  GROUP BY raw_selection,potential_uuid
),
review_queue AS (
  SELECT COALESCE(c.rep_uuid::text,l.raw_selection)
           AS selected_representative_reference,
         COALESCE(c.rep_uuid,l.potential_uuid)
           AS potential_uuid,
         c.rep_uuid IS NOT NULL AS is_canonically_selected,
         COALESCE(c.canonical_active_selection_count,0)
           AS canonical_active_selection_count,
         COALESCE(l.legacy_active_selection_count,0)
           AS legacy_active_selection_count
  FROM canonical_active AS c
  FULL OUTER JOIN legacy_grouped AS l ON l.potential_uuid=c.rep_uuid
)
SELECT
  -- Only the selected REPRESENTATIVE reference; never follower identity.
  q.selected_representative_reference,
  q.canonical_active_selection_count,
  q.legacy_active_selection_count,
  CASE
    WHEN q.is_canonically_selected AND m.user_id IS NOT NULL
      THEN 'CANONICAL_SELECTED_ACTIVE_EU_MANDATE'
    WHEN q.potential_uuid IS NULL THEN 'LEGACY_NON_UUID'
    WHEN m.user_id IS NULL THEN 'UUID_NO_ACTIVE_EU_MANDATE'
    ELSE 'UUID_NOT_CANONICALLY_SELECTED'
  END AS reference_class,
  CASE WHEN q.is_canonically_selected AND m.user_id IS NOT NULL
       THEN q.potential_uuid ELSE NULL END
    AS reviewable_demos_representative_uuid,
  CASE WHEN q.is_canonically_selected AND m.user_id IS NOT NULL
       THEN NULLIF(trim(concat_ws(' ',u.nome,u.cognome)),'')
       ELSE NULL END AS public_representative_name_for_manual_review,
  NULL::text AS institutional_mep_id_not_yet_verified,
  NULL::text AS official_profile_evidence_not_yet_verified,
  'PENDING_INDEPENDENT_OFFICIAL_ID_REVIEW'::text AS review_state,
  FALSE AS approved_for_vote_attribution
FROM review_queue AS q
LEFT JOIN public.users AS u ON u.id=q.potential_uuid
LEFT JOIN LATERAL (
  SELECT pm.user_id
  FROM public.political_mandates AS pm
  WHERE pm.user_id=q.potential_uuid AND pm.office_code='E'
    AND pm.status='ACTIVE' AND pm.starts_at <= now()
    AND (pm.ends_at IS NULL OR pm.ends_at > now())
  LIMIT 1
) AS m ON TRUE
ORDER BY
  CASE WHEN q.is_canonically_selected AND m.user_id IS NOT NULL THEN 0
       WHEN q.is_canonically_selected THEN 1
       WHEN q.potential_uuid IS NOT NULL THEN 2 ELSE 3 END,
  q.selected_representative_reference;

-- Aggregate only for progress: no names, UUIDs or selection values returned.
-- The review output is NOT a vote attribution and must not be written to DB.
