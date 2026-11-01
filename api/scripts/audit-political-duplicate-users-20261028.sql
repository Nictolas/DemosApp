-- DEMOS / Politician duplicate audit / READ-ONLY
-- Issue: https://github.com/Nictolas/DemosApp/issues/396
-- Intended for an authorized, read-only SQL session. No cleanup is performed.
-- Identical names may refer to different people: all matches are SUSPECTS.
-- Legacy dates of birth can be incorrect and must not certify identity.

WITH duplicates AS (
 SELECT lower(btrim(nome)) AS normalized_first,
        lower(btrim(cognome)) AS normalized_last,
        count(*)::int AS profiles,
        count(*) FILTER (WHERE account_type IN ('PERSON','P') AND ruolo='P')::int AS politicians,
        count(distinct data_nascita)::int AS different_birthdates,
        count(*) FILTER (WHERE data_nascita IS NULL)::int AS missing_birthdates,
        count(*) FILTER (
          WHERE email IS NOT NULL OR google_sub IS NOT NULL
             OR apple_user_id IS NOT NULL OR webauthn_credential_id IS NOT NULL
             OR firestore_uid IS NOT NULL
        )::int AS accounts_with_identity_providers,
        count(distinct grado_elezione)::int AS electoral_levels
 FROM public.users
 WHERE account_type IN ('PERSON','P')
   AND nullif(btrim(nome),'') IS NOT NULL
   AND nullif(btrim(cognome),'') IS NOT NULL
 GROUP BY 1,2 HAVING count(*) > 1
)
SELECT count(*)::int AS suspected_groups,
       coalesce(sum(profiles-1),0)::int AS possible_extra_profiles,
       count(*) FILTER (WHERE politicians=profiles)::int AS politician_only_groups,
       count(*) FILTER (WHERE politicians<>profiles)::int AS other_or_mixed_groups,
       count(*) FILTER (WHERE different_birthdates>1)::int AS conflicting_birthdate_groups,
       count(*) FILTER (WHERE accounts_with_identity_providers>0)::int AS auth_sensitive_groups
FROM duplicates;

-- Risk segmentation. SAME NAME + SAME DOB is NOT an identity assertion.
-- Existing legacy import dates were sometimes fabricated; review official IDs.
-- The simultaneous chambers count flags suspicious imports only.
WITH suspected AS (
 SELECT lower(btrim(u.nome)) first_name,lower(btrim(u.cognome)) last_name,
 COUNT(DISTINCT u.id) profiles,
 COUNT(DISTINCT u.id) FILTER(WHERE u.ruolo='P') politicians,
 COUNT(DISTINCT u.id) FILTER(WHERE pm.office_code='C' AND pm.status='ACTIVE' AND pm.source='LEGACY_BACKFILL') chamber_legacy_active,
 COUNT(DISTINCT u.id) FILTER(WHERE pm.office_code='S' AND pm.status='ACTIVE' AND pm.source='LEGACY_BACKFILL') senate_legacy_active,
 COUNT(DISTINCT u.data_nascita) different_birthdates,
 COUNT(DISTINCT u.id) FILTER(WHERE u.data_nascita IS NULL) missing_birthdates,
 COUNT(DISTINCT u.id) FILTER(WHERE u.email IS NOT NULL OR u.google_sub IS NOT NULL OR u.apple_user_id IS NOT NULL OR u.webauthn_credential_id IS NOT NULL OR u.firestore_uid IS NOT NULL) with_auth
 FROM public.users u LEFT JOIN public.political_mandates pm ON pm.user_id=u.id
 WHERE u.account_type IN ('PERSON','P') AND nullif(btrim(u.nome),'') IS NOT NULL AND nullif(btrim(u.cognome),'') IS NOT NULL
 GROUP BY 1,2 HAVING COUNT(DISTINCT u.id)>1
)
SELECT COUNT(*)::int AS groups,
 COUNT(*) FILTER(WHERE politicians=profiles)::int AS only_p,
 COUNT(*) FILTER(WHERE politicians<>profiles)::int AS nonpolitician_or_mixed,
 COUNT(*) FILTER(WHERE politicians=profiles AND with_auth=0 AND missing_birthdates=0 AND different_birthdates=1)::int AS politician_unauthed_same_dob_for_review,
 COUNT(*) FILTER(WHERE with_auth>0)::int AS with_authenticated_accounts,
 COUNT(*) FILTER(WHERE different_birthdates>1)::int AS conflicting_dob,
 COUNT(*) FILTER(WHERE missing_birthdates>0)::int AS missing_dob,
 COUNT(*) FILTER(WHERE chamber_legacy_active>0 AND senate_legacy_active>0)::int AS simultaneous_legacy_chamber_senate_by_name
FROM suspected;

-- Individually review any group before linking institutional IDs or editing.
-- Do not use DOB alone for matching: some legacy imported DOBs were incorrect.
WITH duplicate_keys AS (
 SELECT lower(btrim(nome)) n,lower(btrim(cognome)) c
 FROM public.users
 WHERE account_type IN ('PERSON','P') AND nullif(btrim(nome),'') IS NOT NULL
   AND nullif(btrim(cognome),'') IS NOT NULL
 GROUP BY 1,2 HAVING count(*)>1
)
SELECT u.id, u.nome, u.cognome, u.ruolo, u.grado_elezione, u.data_nascita,
       u.account_type,
       (u.email IS NOT NULL OR u.google_sub IS NOT NULL
        OR u.apple_user_id IS NOT NULL OR u.webauthn_credential_id IS NOT NULL
        OR u.firestore_uid IS NOT NULL) AS has_auth_identity,
       count(pm.id) FILTER(WHERE pm.status='ACTIVE')::int AS active_mandates,
       count(pm.id) FILTER(WHERE pm.source='LEGACY_BACKFILL')::int AS legacy_mandates
FROM public.users u JOIN duplicate_keys k
  ON lower(btrim(u.nome))=k.n AND lower(btrim(u.cognome))=k.c
LEFT JOIN public.political_mandates pm ON pm.user_id=u.id
GROUP BY u.id ORDER BY lower(btrim(u.cognome)),lower(btrim(u.nome)),u.id;

-- ACTIVE and LEGACY_BACKFILL alone do not establish that a politician
-- currently holds a mandate. Compare with official parliamentary sources.
SELECT count(*)::int AS unverified_legacy_active_mandates
FROM public.political_mandates
WHERE source='LEGACY_BACKFILL' AND status='ACTIVE';
