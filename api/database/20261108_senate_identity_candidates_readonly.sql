-- PROD-041: READ ONLY. For authorized human identity reconciliation.
-- NO data is persisted, exported or auto-seeded by these queries.
-- Historical Senate rows are used only as identity EVIDENCE CANDIDATES.
-- Names alone, even uniquely matching, do NOT authorize live mapping.
--
-- Source 1: prior official Senate per-person uri in nominal records
-- Source 2: Openpolis profile URL with DOB suffix (third party)
-- Source 3: DEMOS active Senate mandate + user DOB
-- All three must be checked by a reviewer against live official sources.
-- Rep metadata and Openpolis DOB can have errors or be stale.
--
-- FIRST QUERY: aggregate counts only; safe to log for release checklist.
WITH active AS (
 SELECT u.id AS rep_id, u.data_nascita::text AS birth_date,
        regexp_replace(lower(trim(concat_ws(' ',u.nome,u.cognome))),'[^a-z0-9]','','g') AS fl,
        regexp_replace(lower(trim(concat_ws(' ',u.cognome,u.nome))),'[^a-z0-9]','','g') AS lf
 FROM public.political_mandates m JOIN public.users u ON u.id=m.user_id
 WHERE m.office_code='S' AND m.status='ACTIVE'
   AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())
   AND u.nome IS NOT NULL AND u.cognome IS NOT NULL
), senate AS (
 SELECT DISTINCT uri_politico,
        regexp_replace(lower(trim(nome_politico)),'[^a-z0-9]','','g') AS norm
 FROM public.parlamento_voti_nominali
 WHERE camera='Senato' AND uri_politico ~ '^http://dati[.]senato[.]it/senatore/'
), openpolis AS (
 SELECT DISTINCT url_openpolis,
        regexp_replace(lower(trim(politico_nome)),'[^a-z0-9]','','g') AS norm,
        substring(url_openpolis from '([0-9]{4}-[0-9]{2}-[0-9]{2})/?$') AS public_birth_date
 FROM public.voti_camera
 WHERE url_openpolis ~ '^https://parlamento19[.]openpolis[.]it/persone/'
), candidate AS (
 SELECT a.rep_id, a.birth_date, s.uri_politico, o.url_openpolis,
        o.public_birth_date
 FROM active a JOIN senate s ON s.norm IN(a.fl,a.lf)
 JOIN openpolis o ON o.norm IN(a.fl,a.lf)
), ranked AS (
 SELECT *,
        COUNT(*) OVER (PARTITION BY rep_id) AS per_rep,
        COUNT(*) OVER (PARTITION BY uri_politico) AS per_official_uri,
        COUNT(*) OVER (PARTITION BY url_openpolis) AS per_profile
 FROM candidate
)
SELECT COUNT(*)::integer AS candidate_pairs,
       COUNT(*) FILTER (WHERE per_rep=1 AND per_official_uri=1 AND per_profile=1)::integer
         AS unique_name_candidates,
       COUNT(*) FILTER (WHERE per_rep=1 AND per_official_uri=1 AND per_profile=1
         AND birth_date=public_birth_date)::integer AS name_plus_dob_candidates_not_verified,
       COUNT(*) FILTER (WHERE per_rep=1 AND per_official_uri=1 AND per_profile=1
         AND birth_date IS NOT NULL AND public_birth_date IS NOT NULL
         AND birth_date<>public_birth_date)::integer AS known_birthdate_conflicts_no_go,
       COUNT(*) FILTER (WHERE per_rep=1 AND per_official_uri=1 AND per_profile=1
         AND (birth_date IS NULL OR public_birth_date IS NULL))::integer AS birthdate_missing_no_go,
       COUNT(*) FILTER (WHERE per_rep>1 OR per_official_uri>1 OR per_profile>1)::integer
         AS ambiguous_candidates_no_go
FROM ranked;

-- SECOND QUERY: *human review only*, no automatic import.
-- Only reviewer candidate IDs/URLs; actual name must be checked against
-- official Senate registry plus the current mandate and public profile.
-- Do NOT run this for analytics dashboards or persist it in Google Sheets.
WITH active AS (
 SELECT u.id AS rep_id, u.data_nascita::text AS birth_date,
        regexp_replace(lower(trim(concat_ws(' ',u.nome,u.cognome))),'[^a-z0-9]','','g') AS fl,
        regexp_replace(lower(trim(concat_ws(' ',u.cognome,u.nome))),'[^a-z0-9]','','g') AS lf
 FROM public.political_mandates m JOIN public.users u ON u.id=m.user_id
 WHERE m.office_code='S' AND m.status='ACTIVE'
   AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())
   AND u.nome IS NOT NULL AND u.cognome IS NOT NULL
), senate AS (
 SELECT DISTINCT uri_politico,
        regexp_replace(lower(trim(nome_politico)),'[^a-z0-9]','','g') AS norm
 FROM public.parlamento_voti_nominali
 WHERE camera='Senato' AND uri_politico ~ '^http://dati[.]senato[.]it/senatore/'
), openpolis AS (
 SELECT DISTINCT url_openpolis,
        regexp_replace(lower(trim(politico_nome)),'[^a-z0-9]','','g') AS norm,
        substring(url_openpolis from '([0-9]{4}-[0-9]{2}-[0-9]{2})/?$') AS public_birth_date
 FROM public.voti_camera
 WHERE url_openpolis ~ '^https://parlamento19[.]openpolis[.]it/persone/'
), candidate AS (
 SELECT a.rep_id, a.birth_date, s.uri_politico, o.url_openpolis, o.public_birth_date
 FROM active a JOIN senate s ON s.norm IN(a.fl,a.lf)
 JOIN openpolis o ON o.norm IN(a.fl,a.lf)
), ranked AS (
 SELECT *,
        COUNT(*) OVER (PARTITION BY rep_id) AS per_rep,
        COUNT(*) OVER (PARTITION BY uri_politico) AS per_official_uri,
        COUNT(*) OVER (PARTITION BY url_openpolis) AS per_profile
 FROM candidate
)
SELECT rep_id, uri_politico AS official_senate_person_uri,
       url_openpolis AS openpolis_person_url,
       'UNVERIFIED_REQUIRES_OFFICIAL_REGISTRY_REVIEW'::text AS status
FROM ranked
WHERE per_rep=1 AND per_official_uri=1 AND per_profile=1
  AND birth_date=public_birth_date
ORDER BY rep_id
LIMIT 250;
