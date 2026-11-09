-- PROD-041 / Issue #396: selected-only institutional registry cross-check.
-- READ ONLY. Snapshot of public Italian parliamentary registry identities
-- checked on 2026-11-08. Not a permanent people catalog, not an importer,
-- and never a VERIFIED vote-attribution bridge. Update evidence from the
-- OFFICIAL institution before approving any identity, DOB or active mandate.
-- No follower IDs, vote choice, history or personal account fields exposed.
--
-- official_url is evidence for human review, NOT the Openpolis roll-call
-- source_person_id. Source crosswalk still requires independent validation.
WITH official_reference(full_name,official_office,official_birth_date,official_url) AS (
 VALUES
 ('claudio borghi','it.senato',DATE '1970-06-06','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00033070'),
 ('nicola fratoianni','it.camera',DATE '1972-10-04','https://www.camera.it/deputati/elenco/19-305880'),
 ('marco grimaldi','it.camera',DATE '1980-11-08','https://www.camera.it/deputati/elezioni/eletti'),
 ('carlo calenda','it.senato',DATE '1973-04-09','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00030110'),
 ('peppe de cristofaro','it.senato',DATE '1971-06-26','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00022918'),
 ('benedetto della vedova','it.camera',DATE '1962-04-03','https://www.camera.it/deputati/elenco/19-301577'),
 ('matteo salvini','it.senato',DATE '1973-03-09','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025407')
), selected AS (
 SELECT DISTINCT ps.political_office_id AS selected_office, u.id AS representative_id,
        u.nome,u.cognome,u.data_nascita AS demos_birth_date
 FROM public.political_selections ps
 JOIN public.users follower ON follower.id=ps.user_id AND lower(follower.status)='a'
 JOIN public.users u ON u.id=ps.selected_user_id
 WHERE ps.selection_kind='representative'
   AND ps.political_office_id IN ('it.camera','it.senato')
   AND EXISTS (
     SELECT 1 FROM public.political_mandates m
     WHERE m.user_id=u.id AND m.status='ACTIVE'
       AND m.office_code=CASE WHEN ps.political_office_id='it.camera' THEN 'C' ELSE 'S' END
       AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now())
   )
), crosschecked AS (
 SELECT s.selected_office,s.nome,s.cognome,s.representative_id,
        s.demos_birth_date,r.official_birth_date,r.official_office,r.official_url,
        CASE
          WHEN r.full_name IS NULL THEN 'NEEDS_NEW_OFFICIAL_REGISTRY_REVIEW'
          WHEN s.selected_office<>r.official_office THEN 'OFFICE_MISMATCH_REVIEW'
          WHEN s.demos_birth_date IS DISTINCT FROM r.official_birth_date THEN 'DOB_MISMATCH_REVIEW'
          ELSE 'PUBLIC_BIO_MATCH_NOT_ID_VERIFIED'
        END AS audit_status
 FROM selected s
 LEFT JOIN official_reference r
   ON lower(trim(concat_ws(' ',s.nome,s.cognome)))=r.full_name
)
SELECT selected_office,nome,cognome,representative_id,audit_status,
       demos_birth_date,official_birth_date,official_office,official_url
FROM crosschecked
ORDER BY selected_office,cognome,nome;

-- Reviewer-only SQL output contains public DOBs and person UUIDs but never
-- follower IDs. Do not copy the output to a public sheet, logs or analytics.
-- No UPDATE/INSERT/DELETE or production schema mutations are authorized.
