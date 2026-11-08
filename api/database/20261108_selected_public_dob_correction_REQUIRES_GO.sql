-- PROD-041: CANDIDATE ONLY. DO NOT RUN IN PRODUCTION WITHOUT A SEPARATE
-- EXPLICIT DPO/OPERATIONS GO, A REAL VERIFIED BACKUP+RESTORE, CURRENT
-- FIRST-PARTY SOURCE RECHECK, AND THE CORRECT PRODUCTION DATABASE TARGET.
-- Changes ONLY two public DOB fields in users + user_profile, atomically.
-- Does not touch auth, selectors, opinions, mandates, history, voting links.
-- The selected representative UUIDs and old dates are pinned to the
-- read-only 2026-11-08 database audit; if they drift, abort the whole batch.
-- All evidence URLs are for a HUMAN reviewer, never for auto-identity approval:
-- Marco Grimaldi: https://www.camera.it/deputati/elezioni/eletti
-- Carlo Calenda: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00030110
-- Matteo Salvini: https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00025407
--
-- Fail-closed triple gate: these session LOCAL settings must be authorized
-- separately and explicitly set INSIDE the transaction by the reviewer:
-- demos.prod041_dob_approval = 'GO_THREE_PUBLIC_DOBS'
-- demos.prod041_backup_restore_proven = 'true'
-- demos.prod041_official_registry_rechecked = 'true'
-- No SET of these settings is included here. Without them this file cannot
-- write anything. This is an approval-gated migration CANDIDATE, not a GO.
BEGIN;
DO $prod041_three_public_dobs$
DECLARE
  rec record;
  exact_accounts integer;
  live_mandates integer;
  selected_count integer;
  original_user_date date;
  original_profile_date date;
  changed_rows integer;
BEGIN
  IF current_setting('demos.prod041_dob_approval', true)
       IS DISTINCT FROM 'GO_THREE_PUBLIC_DOBS'
    OR current_setting('demos.prod041_backup_restore_proven', true)
       IS DISTINCT FROM 'true'
    OR current_setting('demos.prod041_official_registry_rechecked', true)
       IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'PROD041_DOB_EXPLICIT_GO_AND_BACKUP_REQUIRED'
      USING ERRCODE='P0001';
  END IF;

  FOR rec IN
    SELECT *
    FROM (VALUES
      ('2808589f-a913-4a54-aee8-56040d98c5db'::uuid, 'Marco'::text, 'Grimaldi'::text,
       'C'::text, DATE '1980-10-22', DATE '1980-11-08'),
      ('e35587f2-0b72-464f-a011-f0576631b410'::uuid, 'Carlo'::text, 'Calenda'::text,
       'S'::text, DATE '1973-09-04', DATE '1973-04-09'),
      ('fc1d0743-0d61-4eed-9daf-9147e399e307'::uuid, 'Matteo'::text, 'Salvini'::text,
       'S'::text, DATE '1973-09-03', DATE '1973-03-09')
    ) AS t(representative_id, first_name, last_name, target_chamber, old_dob, new_dob)
  LOOP
    SELECT count(*)::integer INTO exact_accounts
    FROM public.users u
    WHERE lower(trim(u.nome)) = lower(rec.first_name)
      AND lower(trim(u.cognome)) = lower(rec.last_name);
    IF exact_accounts <> 1 THEN
      RAISE EXCEPTION 'PROD041_DOB_AMBIGUOUS_NAME_ACCOUNTS' USING ERRCODE='P0001';
    END IF;

    SELECT u.data_nascita, p.data_nascita
      INTO original_user_date, original_profile_date
    FROM public.users u
    JOIN public.user_profile p ON p.user_id=u.id
    WHERE u.id=rec.representative_id
      AND lower(trim(u.nome))=lower(rec.first_name)
      AND lower(trim(u.cognome))=lower(rec.last_name)
    FOR UPDATE OF u,p;
    IF NOT FOUND OR original_user_date IS NULL OR original_profile_date IS NULL
       OR original_user_date IS DISTINCT FROM original_profile_date
       OR original_user_date NOT IN (rec.old_dob,rec.new_dob)
       OR original_profile_date NOT IN (rec.old_dob,rec.new_dob)
    THEN
      RAISE EXCEPTION 'PROD041_DOB_PROFILE_OR_ACCOUNT_DRIFT' USING ERRCODE='P0001';
    END IF;

    SELECT count(*)::integer INTO live_mandates
    FROM public.political_mandates m
    WHERE m.user_id=rec.representative_id AND m.status='ACTIVE'
      AND m.office_code=rec.target_chamber
      AND m.starts_at<=now() AND (m.ends_at IS NULL OR m.ends_at>now());
    IF live_mandates <> 1 THEN
      RAISE EXCEPTION 'PROD041_DOB_MANDATE_CHANGED' USING ERRCODE='P0001';
    END IF;

    SELECT count(*)::integer INTO selected_count
    FROM public.political_selections ps
    JOIN public.users follower ON follower.id=ps.user_id
      AND lower(follower.status)='a'
    WHERE ps.selected_user_id=rec.representative_id
      AND ps.selection_kind='representative'
      AND ps.political_office_id=
        CASE WHEN rec.target_chamber='C' THEN 'it.camera' ELSE 'it.senato' END;
    IF selected_count<1 THEN
      RAISE EXCEPTION 'PROD041_DOB_NO_ACTIVE_FOLLOWERS' USING ERRCODE='P0001';
    END IF;

    IF original_user_date=rec.old_dob THEN
      UPDATE public.users
      SET data_nascita=rec.new_dob,updated_at=now()
      WHERE id=rec.representative_id AND data_nascita=rec.old_dob;
      GET DIAGNOSTICS changed_rows=ROW_COUNT;
      IF changed_rows<>1 THEN RAISE EXCEPTION 'PROD041_DOB_USER_UPDATE_FAILED'; END IF;

      UPDATE public.user_profile
      SET data_nascita=rec.new_dob,updated_at=now()
      WHERE user_id=rec.representative_id AND data_nascita=rec.old_dob;
      GET DIAGNOSTICS changed_rows=ROW_COUNT;
      IF changed_rows<>1 THEN RAISE EXCEPTION 'PROD041_DOB_PROFILE_UPDATE_FAILED'; END IF;
    END IF; -- Idempotent when BOTH stored DOBs were already corrected.
  END LOOP;
END
$prod041_three_public_dobs$;
COMMIT;
