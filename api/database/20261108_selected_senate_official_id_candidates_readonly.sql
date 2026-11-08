-- PROD-041 Senate person-ID evidence candidates (NOT VOTE HISTORY).
-- OPERATOR ONLY / READ ONLY / FREE-TIER SAFE.
-- This query does not approve identity, save votes, or change selections.
-- Name equality narrows candidates but is never enough to mark VERIFIED.
-- Source table is a pre-existing legacy nominal-rollcall cache; it is
-- consulted only for source person URLs, never to reconstruct old votes.
WITH selected_senators AS (
  SELECT DISTINCT ps.selected_user_id AS representative_id,
         u.nome, u.cognome
  FROM public.political_selections ps
  JOIN public.users follower
    ON follower.id = ps.user_id AND lower(follower.status) = 'a'
  JOIN public.users u ON u.id = ps.selected_user_id
  WHERE ps.selection_kind = 'representative'
    AND ps.political_office_id = 'it.senato'
    AND EXISTS (
      SELECT 1 FROM public.political_mandates m
      WHERE m.user_id = u.id
        AND m.office_code = 'S' AND m.status = 'ACTIVE'
        AND m.starts_at <= now()
        AND (m.ends_at IS NULL OR m.ends_at > now())
    )
), source_person_ids AS (
  SELECT s.representative_id, v.uri_politico,
         regexp_replace(v.uri_politico,
           '^https?://dati[.]senato[.]it/senatore/([0-9]{1,10})/?$', '\1'
         ) AS official_senator_id
  FROM selected_senators s
  JOIN public.parlamento_voti_nominali v
    ON v.camera = 'Senato'
   AND lower(trim(v.nome_politico)) IN (
      lower(trim(s.nome || ' ' || s.cognome)),
      lower(trim(s.cognome || ' ' || s.nome))
   )
  WHERE v.uri_politico ~ '^https?://dati[.]senato[.]it/senatore/[0-9]{1,10}/?$'
), unique_candidates AS (
  SELECT representative_id,
         COUNT(DISTINCT official_senator_id)::integer AS candidate_count,
         MIN(official_senator_id) AS sole_candidate_id,
         COUNT(*)::integer AS source_rows_consulted
  FROM source_person_ids
  GROUP BY representative_id
)
SELECT s.nome, s.cognome, s.representative_id,
       COALESCE(c.candidate_count, 0) AS official_senator_id_candidates,
       COALESCE(c.source_rows_consulted, 0) AS source_rows_consulted,
       CASE WHEN c.candidate_count = 1 THEN
         'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=' ||
         c.sole_candidate_id
       ELSE NULL END AS official_review_url,
       CASE
         WHEN c.candidate_count = 1 THEN 'UNVERIFIED_OFFICIAL_ID_CANDIDATE_REVIEW_NAME_DOB_AND_OFFICE'
         WHEN c.candidate_count > 1 THEN 'AMBIGUOUS_SOURCE_PERSON_IDENTITIES'
         ELSE 'NO_OFFICIAL_PERSON_ID_IN_EXISTING_CACHE'
       END AS review_status
FROM selected_senators s
LEFT JOIN unique_candidates c ON c.representative_id = s.representative_id
ORDER BY s.cognome, s.nome;

-- This review queue must NEVER be used to INSERT source_person_id links
-- without independent verification of first-party registry identity,
-- current active office and stable DEMOS person ID. For Senato, the
-- Openpolis roll-call person href and the first-party Senato DID are two
-- DIFFERENT identifiers requiring separate corroboration.
