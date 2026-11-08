-- DEMOS PROD-041 / PE: authorized identity-review queue (READ ONLY).
-- Works in production and in the existing unified staging, even if the
-- legacy 'rappresentante_europeo' column does not exist on staging.
-- Run via a restricted backend/DB reviewer. Never expose via a public API.
-- DO NOT export followers, DOB, addresses, votes or implicit name matches.
-- This query never makes a MepId↔UUID link or marks an identity VERIFIED.
--
-- The official MepId and documentary evidence must be entered separately
-- by an authorized reviewer based on an independently checked EP profile.
-- In particular, LEGACY_NON_UUID is NEVER silently guessed from a name.
WITH active_selections AS (
  SELECT NULLIF(trim(to_jsonb(r)->>'rappresentante_europeo'),'') AS raw_selection
  FROM public.user_representatives AS r
  WHERE EXISTS (
    SELECT 1 FROM public.users AS follower
    WHERE follower.id=r.user_id AND follower.status='a'
  )
),
selected AS (
  SELECT raw_selection,
         CASE
           WHEN raw_selection ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           THEN raw_selection::uuid ELSE NULL::uuid
         END AS potential_uuid
  FROM active_selections
  WHERE raw_selection IS NOT NULL
),
grouped AS (
  SELECT raw_selection,potential_uuid,
         COUNT(*)::integer AS active_selection_count
  FROM selected
  GROUP BY raw_selection,potential_uuid
)
SELECT
  -- The value is the selected representative reference, NOT a follower ID.
  g.raw_selection AS selected_representative_reference,
  g.active_selection_count,
  CASE
    WHEN g.potential_uuid IS NULL THEN 'LEGACY_NON_UUID'
    WHEN m.user_id IS NULL THEN 'UUID_NO_ACTIVE_EU_MANDATE'
    ELSE 'UUID_ACTIVE_EU_MANDATE'
  END AS reference_class,
  CASE WHEN m.user_id IS NOT NULL THEN g.potential_uuid ELSE NULL END
    AS reviewable_demos_representative_uuid,
  CASE WHEN m.user_id IS NOT NULL
       THEN NULLIF(trim(concat_ws(' ',u.nome,u.cognome)),'')
       ELSE NULL END AS public_representative_name_for_manual_review,
  NULL::text AS institutional_mep_id_not_yet_verified,
  NULL::text AS official_profile_evidence_not_yet_verified,
  'PENDING_INDEPENDENT_OFFICIAL_ID_REVIEW'::text AS review_state,
  FALSE AS approved_for_vote_attribution
FROM grouped AS g
LEFT JOIN public.users AS u ON u.id=g.potential_uuid
LEFT JOIN LATERAL (
  SELECT pm.user_id
  FROM public.political_mandates AS pm
  WHERE pm.user_id=g.potential_uuid AND pm.office_code='E'
    AND pm.status='ACTIVE'
  LIMIT 1
) AS m ON TRUE
ORDER BY
  CASE WHEN m.user_id IS NOT NULL THEN 0
       WHEN g.potential_uuid IS NOT NULL THEN 1 ELSE 2 END,
  g.raw_selection;

-- Reader-only aggregate. No personal or representative identifiers displayed.
-- Expected on 08/11/2026 production: 10 selections / 7 raw unique values,
-- of which 3 valid selected active EU UUIDs, 1 unresolved UUID, 3 legacy refs.
-- Staging may correctly show zero until the EU selection column is installed.
