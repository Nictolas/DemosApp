-- DEMOS users / user_profile migration: aggregate-only preflight (PostgreSQL 17)
-- READ ONLY. No INSERT, UPDATE, DELETE, CREATE, ALTER or DROP.
-- Returns one aggregate row; does not export user IDs or personal data.
-- Intended for an authorized read-only connection. Never use timestamps to
-- resolve disputed birth dates or political degrees.
WITH paired AS (
  SELECT
    p.user_id IS NOT NULL AS has_profile,
    u.account_type, u.ruolo,
    u.avatar_config AS legacy_avatar,
    p.avatar_config AS profile_avatar,
    u.data_nascita AS legacy_birth,
    p.data_nascita AS profile_birth,
    u.grado_elezione AS legacy_grade,
    p.grado_elezione AS profile_grade,
    u.grado_candidatura AS legacy_candidacy_grade,
    p.grado_candidatura AS profile_candidacy_grade,
    u.cittadinanza AS legacy_citizenship,
    p.cittadinanza AS profile_citizenship,
    (COALESCE(p.paese_residenza, u.paese_residenza) IS DISTINCT FROM u.paese_residenza) AS country_changes,
    (COALESCE(p.regione_residenza, u.regione_residenza) IS DISTINCT FROM u.regione_residenza) AS region_changes,
    (COALESCE(p.provincia_residenza, u.provincia_residenza) IS DISTINCT FROM u.provincia_residenza) AS province_changes,
    (COALESCE(p.comune_residenza, u.comune_residenza) IS DISTINCT FROM u.comune_residenza) AS municipality_changes
  FROM public.users u LEFT JOIN public.user_profile p ON p.user_id = u.id
),
normalized AS (
  SELECT *,
    CASE WHEN legacy_avatar IS NOT NULL
      AND pg_input_is_valid(legacy_avatar, 'jsonb')
      THEN legacy_avatar::jsonb ELSE NULL END AS legacy_avatar_jsonb
  FROM paired
)
SELECT
  COUNT(*) AS users_total,
  COUNT(*) FILTER (WHERE has_profile) AS profiles_present,
  COUNT(*) FILTER (WHERE NOT has_profile) AS profiles_missing,
  COUNT(*) FILTER (WHERE NOT has_profile AND account_type = 'PERSON') AS missing_person_profiles,
  COUNT(*) FILTER (WHERE NOT has_profile AND legacy_birth IS NOT NULL) AS missing_profiles_with_birth,
  COUNT(*) FILTER (WHERE NOT has_profile AND legacy_avatar IS NOT NULL) AS missing_profiles_with_avatar,
  COUNT(*) FILTER (WHERE has_profile AND legacy_avatar IS NOT NULL AND profile_avatar IS NULL) AS legacy_only_avatars_with_profile,
  COUNT(*) FILTER (WHERE NOT has_profile AND legacy_avatar IS NOT NULL AND pg_input_is_valid(legacy_avatar, 'jsonb')) AS missing_profile_recoverable_avatars,
  COUNT(*) FILTER (WHERE has_profile AND legacy_avatar IS NOT NULL AND profile_avatar IS NULL AND pg_input_is_valid(legacy_avatar, 'jsonb')) AS existing_profile_recoverable_avatars,
  COUNT(*) FILTER (WHERE (NOT has_profile OR profile_avatar IS NULL) AND legacy_avatar IS NOT NULL AND pg_input_is_valid(legacy_avatar, 'jsonb')) AS total_recoverable_avatars,
  COUNT(*) FILTER (WHERE has_profile AND legacy_avatar IS NOT NULL AND profile_avatar IS NOT NULL
                  AND legacy_avatar_jsonb IS DISTINCT FROM profile_avatar) AS avatar_semantic_conflicts,
  COUNT(*) FILTER (WHERE legacy_avatar IS NOT NULL AND NOT pg_input_is_valid(legacy_avatar, 'jsonb')) AS invalid_legacy_avatar_json,
  COUNT(*) FILTER (WHERE has_profile AND legacy_grade IS NULL AND profile_grade IS NOT NULL) AS grades_only_profile,
  COUNT(*) FILTER (WHERE has_profile AND legacy_grade IS NOT NULL AND profile_grade IS NOT NULL
                  AND legacy_grade IS DISTINCT FROM profile_grade) AS grades_conflicting,
  COUNT(*) FILTER (WHERE has_profile AND legacy_candidacy_grade IS NULL
                  AND profile_candidacy_grade IS NOT NULL) AS candidacy_grades_only_profile,
  COUNT(*) FILTER (WHERE has_profile AND legacy_birth IS DISTINCT FROM profile_birth
                  AND EXTRACT(YEAR FROM legacy_birth) IS NOT DISTINCT FROM
                      EXTRACT(YEAR FROM profile_birth)) AS birth_conflicts_same_year,
  COUNT(*) FILTER (WHERE has_profile AND legacy_birth IS DISTINCT FROM profile_birth
                  AND EXTRACT(YEAR FROM legacy_birth) IS DISTINCT FROM
                      EXTRACT(YEAR FROM profile_birth)) AS birth_conflicts_different_year,
  COUNT(*) FILTER (WHERE has_profile AND legacy_citizenship IS DISTINCT FROM profile_citizenship) AS citizenship_mismatches,
  COUNT(*) FILTER (WHERE country_changes) AS residence_country_projection_changes,
  COUNT(*) FILTER (WHERE region_changes) AS residence_region_projection_changes,
  COUNT(*) FILTER (WHERE province_changes) AS residence_province_projection_changes,
  COUNT(*) FILTER (WHERE municipality_changes) AS residence_municipality_projection_changes
FROM normalized;
