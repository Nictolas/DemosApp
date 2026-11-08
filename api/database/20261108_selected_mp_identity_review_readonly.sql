-- PROD-041: FREE-TIER SELECTED-ONLY identity reconciliation.
-- READ ONLY. For authorized operational review; no exported list, writes or
-- automatic source-person mapping. No follower identities are returned.
-- Check each selected person against authoritative institutional registries
-- before any identity link can be promoted to VERIFIED.
--
-- First query: aggregate sizes only, safe for operational progress reports.
WITH active_selected AS (
 SELECT ps.political_office_id, ps.selected_user_id AS representative_id
 FROM public.political_selections ps
 WHERE ps.selection_kind='representative'
   AND ps.political_office_id IN ('it.camera','it.senato')
   AND EXISTS (
     SELECT 1 FROM public.users follower
     WHERE follower.id=ps.user_id AND lower(follower.status)='a'
   )
   AND EXISTS (
     SELECT 1 FROM public.political_mandates m
     WHERE m.user_id=ps.selected_user_id AND m.status='ACTIVE'
       AND m.office_code=CASE WHEN ps.political_office_id='it.camera' THEN 'C' ELSE 'S' END
       AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())
   )
)
SELECT political_office_id, COUNT(*)::integer AS active_selection_rows,
       COUNT(DISTINCT representative_id)::integer AS selected_active_representatives
FROM active_selected
GROUP BY political_office_id
ORDER BY political_office_id;

-- Second query: restricted reviewer queue. Only representative IDs and
-- public names, not follower identities, private DOB, voting histories or
-- provisional nominal statuses. Output is NOT evidence of identity by itself.
WITH selected AS (
 SELECT DISTINCT ps.political_office_id, ps.selected_user_id AS representative_id
 FROM public.political_selections ps
 WHERE ps.selection_kind='representative'
   AND ps.political_office_id IN ('it.camera','it.senato')
   AND EXISTS (
     SELECT 1 FROM public.users follower
     WHERE follower.id=ps.user_id AND lower(follower.status)='a'
   )
   AND EXISTS (
     SELECT 1 FROM public.political_mandates m
     WHERE m.user_id=ps.selected_user_id AND m.status='ACTIVE'
       AND m.office_code=CASE WHEN ps.political_office_id='it.camera' THEN 'C' ELSE 'S' END
       AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())
   )
)
SELECT s.political_office_id, s.representative_id, u.nome, u.cognome,
       'PENDING_INDEPENDENT_OFFICIAL_ID_REVIEW'::text AS review_status
FROM selected s JOIN public.users u ON u.id=s.representative_id
ORDER BY s.political_office_id, u.cognome, u.nome;
