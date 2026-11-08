-- PROD-041 operator-only DOB correction preflight: READ ONLY / NO GO.
-- Source records are public parliament biographies and 2026-11-08 DEMOS
-- review snapshot. This file reveals NO follower identifiers or emails,
-- and cannot approve institutional source-person IDs or persist a vote.
-- Use immediately BEFORE a separately authorized correction and again AFTER.
-- This is deliberately scoped to the exact THREE currently selected UUIDs.
WITH targets(representative_id,first_name,last_name,chamber,previous_dob,official_dob,official_evidence_url) AS (
  VALUES
  ('2808589f-a913-4a54-aee8-56040d98c5db'::uuid,'Marco'::text,'Grimaldi'::text,'C'::text,
   DATE '1980-10-22',DATE '1980-11-08','https://www.camera.it/deputati/elezioni/eletti'),
  ('e35587f2-0b72-464f-a011-f0576631b410'::uuid,'Carlo'::text,'Calenda'::text,'S'::text,
   DATE '1973-09-04',DATE '1973-04-09','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00030110'),
  ('fc1d0743-0d61-4eed-9daf-9147e399e307'::uuid,'Matteo'::text,'Salvini'::text,'S'::text,
   DATE '1973-09-03',DATE '1973-03-09','https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025407')
), checks AS (
 SELECT t.first_name,t.last_name,t.representative_id,t.chamber,
        t.previous_dob,t.official_dob,t.official_evidence_url,
        u.data_nascita AS current_user_dob,p.data_nascita AS current_profile_dob,
        (SELECT count(*)::integer FROM public.users same
         WHERE lower(trim(same.nome))=lower(t.first_name)
           AND lower(trim(same.cognome))=lower(t.last_name)) AS name_account_count,
        (SELECT count(*)::integer FROM public.user_profile prof
         WHERE prof.user_id=t.representative_id) AS profile_count,
        (SELECT count(*)::integer FROM public.political_mandates m
         WHERE m.user_id=t.representative_id AND m.office_code=t.chamber
           AND m.status='ACTIVE' AND m.starts_at<=now()
           AND (m.ends_at IS NULL OR m.ends_at>now())) AS current_office_mandates,
        EXISTS (
          SELECT 1 FROM public.political_selections ps
          JOIN public.users follower ON follower.id=ps.user_id
            AND lower(follower.status)='a'
          WHERE ps.selected_user_id=t.representative_id
            AND ps.selection_kind='representative'
            AND ps.political_office_id=
              CASE WHEN t.chamber='C' THEN 'it.camera' ELSE 'it.senato' END
        ) AS has_active_selection
 FROM targets t
 LEFT JOIN public.users u ON u.id=t.representative_id
  AND lower(trim(u.nome))=lower(t.first_name)
  AND lower(trim(u.cognome))=lower(t.last_name)
 LEFT JOIN public.user_profile p ON p.user_id=u.id
)
SELECT first_name,last_name,representative_id,chamber,
       current_user_dob,current_profile_dob,previous_dob,official_dob,
       official_evidence_url,
       CASE
         WHEN name_account_count<>1 OR profile_count<>1
           THEN 'HOLD_DUPLICATE_OR_MISSING_PROFILE'
         WHEN current_office_mandates<>1 OR NOT has_active_selection
           THEN 'HOLD_NO_ELIGIBLE_SELECTED_MANDATE'
         WHEN current_user_dob=official_dob AND current_profile_dob=official_dob
           THEN 'ALREADY_CORRECTED_BOTH_FIELDS'
         WHEN current_user_dob=previous_dob AND current_profile_dob=previous_dob
           THEN 'READY_FOR_SEPARATE_DPO_GO_AND_REAL_BACKUP'
         ELSE 'HOLD_UNEXPECTED_BIRTHDATE_OR_PARTIAL_CORRECTION'
       END AS audit_status
FROM checks
ORDER BY last_name,first_name;

-- Even READY does NOT authorize any write: it describes DB consistency.
-- No automatic migration, no account merging, no missing historical votes.
