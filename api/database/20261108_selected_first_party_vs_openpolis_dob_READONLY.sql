-- PROD-041: selected ONLY / first-party vs legacy source-profile disagreement.
-- READ ONLY. Reviewer SQL, no approvals, no account merges, no row updates.
-- This is a snapshot of 7 publicly documented politician biographies on
-- 2026-11-08. Newly followed unknown names never receive automatic IDs.
-- Official registry is the authoritative DOB/office. An Openpolis URL slug
-- is *not* a birthdate source: a stale suffix is a SECONDARY conflict,
-- NEVER permission to replace the official/DEMOS biographical field.
-- No follower ID, selection-voter data, source vote records or history
-- is returned. Restrict all cache reads to currently followed MPs.
WITH reference(full_name,official_office,official_dob,official_url) AS (
 VALUES
 ('claudio borghi','it.senato',DATE '1970-06-06','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00033070'),
 ('nicola fratoianni','it.camera',DATE '1972-10-04','https://www.camera.it/deputati/elenco/19-305880'),
 ('marco grimaldi','it.camera',DATE '1980-11-08','https://www.camera.it/deputati/elezioni/eletti'),
 ('carlo calenda','it.senato',DATE '1973-04-09','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00030110'),
 ('peppe de cristofaro','it.senato',DATE '1971-06-26','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00022918'),
 ('benedetto della vedova','it.camera',DATE '1962-04-03','https://www.camera.it/deputati/elenco/19-301577'),
 ('matteo salvini','it.senato',DATE '1973-03-09','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025407')
), selected AS (
 SELECT DISTINCT ps.political_office_id AS selected_office,
        u.id AS representative_id, u.nome,u.cognome,u.data_nascita AS demos_dob
 FROM public.political_selections ps
 JOIN public.users follower ON follower.id=ps.user_id AND lower(follower.status)='a'
 JOIN public.users u ON u.id=ps.selected_user_id
 WHERE ps.selection_kind='representative'
   AND ps.political_office_id IN('it.camera','it.senato')
   AND EXISTS(SELECT 1 FROM public.political_mandates m
     WHERE m.user_id=u.id AND m.status='ACTIVE'
       AND m.office_code=CASE WHEN ps.political_office_id='it.camera' THEN 'C' ELSE 'S' END
       AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now()))
), legacy_candidates AS (
 SELECT s.representative_id,
        COUNT(DISTINCT v.url_openpolis)::integer AS source_profile_count,
        MIN(v.url_openpolis) AS candidate_url
 FROM selected s LEFT JOIN public.voti_camera v
   ON lower(trim(v.politico_nome))=lower(trim(concat_ws(' ',s.nome,s.cognome)))
  AND v.url_openpolis ~ '^https://parlamento19[.]openpolis[.]it/persone/[a-z0-9-]{4,120}/?$'
 GROUP BY s.representative_id
), comparison AS (
 SELECT s.selected_office,s.nome,s.cognome,s.representative_id,
        s.demos_dob,r.official_dob,r.official_office,r.official_url,
        l.source_profile_count,
        CASE WHEN l.source_profile_count=1 THEN l.candidate_url ELSE NULL END
           AS sole_secondary_profile_url,
        CASE WHEN l.source_profile_count=1
          THEN substring(l.candidate_url FROM '([0-9]{4}-[0-9]{2}-[0-9]{2})/?$')
          ELSE NULL END AS secondary_slug_dob
 FROM selected s
 LEFT JOIN reference r
   ON lower(trim(concat_ws(' ',s.nome,s.cognome)))=r.full_name
 LEFT JOIN legacy_candidates l ON l.representative_id=s.representative_id
)
SELECT selected_office,nome,cognome,representative_id,official_office,
       demos_dob,official_dob,secondary_slug_dob,official_url,
       sole_secondary_profile_url,
       CASE WHEN official_url IS NULL THEN 'NEEDS_NEW_FIRST_PARTY_REGISTRY_REVIEW'
            WHEN selected_office<>official_office THEN 'HOLD_WRONG_CURRENT_OFFICE'
            WHEN demos_dob IS DISTINCT FROM official_dob THEN 'HOLD_DEMOS_BIRTHDATE_DRIFT'
            ELSE 'FIRST_PARTY_BIO_MATCH_ONLY_ID_NOT_VERIFIED'
       END AS primary_review_status,
       CASE WHEN official_url IS NULL THEN 'FIRST_PARTY_REFERENCE_MISSING'
            WHEN source_profile_count>1 THEN 'AMBIGUOUS_SECONDARY_PROFILES'
            WHEN source_profile_count=0 THEN 'NO_SECONDARY_PROFILE_IN_EXISTING_CACHE'
            WHEN secondary_slug_dob IS NULL THEN 'SECONDARY_PROFILE_WITHOUT_DOB_SUFFIX'
            WHEN secondary_slug_dob<>to_char(official_dob,'YYYY-MM-DD')
              THEN 'SECONDARY_SLUG_CONFLICTS_WITH_FIRST_PARTY'
            ELSE 'SECONDARY_SLUG_AGREES_NOT_PROOF_OF_IDENTITY'
       END AS secondary_review_status
FROM comparison
ORDER BY selected_office,cognome,nome;

-- Only first-party evidence can resolve biographical conflicts.
-- A secondary slug conflict NEVER overrides an official date of birth,
-- grants VERIFIED, authorizes a vote, or triggers correction.
