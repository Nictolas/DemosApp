-- DEMOS profile migration: synthetic-only FULL profile backfill rehearsal.
-- Only qa_user_profile_20261028 tables, no public tables, no real data.
-- Every change is inside a rollback-only subtransaction.
DO $qa$
DECLARE
  v_first integer;
  v_second integer;
  v_avatar_first integer;
  v_avatar_second integer;
  v_count integer;
  v_grade text;
  v_municipality text;
  v_avatar jsonb;
  v_birth date;
  v_official_before integer;
  v_official_after integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM qa_user_profile_20261028.user_profile;
  IF v_count <> 7 THEN RAISE EXCEPTION 'QA fixture expected 7 canonical profiles, got %', v_count; END IF;
  SELECT COUNT(*) INTO v_official_before FROM qa_user_profile_20261028.user_political_territories
    WHERE source <> 'legacy_profile';
  BEGIN
    -- Full 26-column copy, but ONLY for users lacking a profile.
    -- No default sex or citizenship; never infer facts from names/roles.
    INSERT INTO qa_user_profile_20261028.user_profile
      (user_id, genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura, facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url, website_url, twitch_url, youtube_url, avatar_config)
    SELECT u.id, u.genere, u.data_nascita, u.cittadinanza, u.paese_residenza, u.regione_residenza, u.provincia_residenza, u.comune_residenza, u.grado_elezione, u.paese_elezione, u.regione_elezione, u.provincia_elezione, u.comune_elezione, u.grado_candidatura, u.paese_candidatura, u.regione_candidatura, u.provincia_candidatura, u.comune_candidatura, u.facebook_url, u.twitter_url, u.instagram_url, u.linkedin_url, u.telegram_url, u.website_url, u.twitch_url, u.youtube_url, CASE WHEN pg_input_is_valid(u.avatar_config,'jsonb') THEN u.avatar_config::jsonb ELSE NULL END
    FROM qa_user_profile_20261028.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM qa_user_profile_20261028.user_profile p WHERE p.user_id=u.id
    ) ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS v_first = ROW_COUNT;
    INSERT INTO qa_user_profile_20261028.user_profile
      (user_id, genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura, facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url, website_url, twitch_url, youtube_url, avatar_config)
    SELECT u.id, u.genere, u.data_nascita, u.cittadinanza, u.paese_residenza, u.regione_residenza, u.provincia_residenza, u.comune_residenza, u.grado_elezione, u.paese_elezione, u.regione_elezione, u.provincia_elezione, u.comune_elezione, u.grado_candidatura, u.paese_candidatura, u.regione_candidatura, u.provincia_candidatura, u.comune_candidatura, u.facebook_url, u.twitter_url, u.instagram_url, u.linkedin_url, u.telegram_url, u.website_url, u.twitch_url, u.youtube_url, CASE WHEN pg_input_is_valid(u.avatar_config,'jsonb') THEN u.avatar_config::jsonb ELSE NULL END
    FROM qa_user_profile_20261028.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM qa_user_profile_20261028.user_profile p WHERE p.user_id=u.id
    ) ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS v_second = ROW_COUNT;
    IF v_first <> 1 OR v_second <> 0 THEN RAISE EXCEPTION 'Profile full backfill not idempotent %, %',v_first,v_second; END IF;
    SELECT COUNT(*) INTO v_count FROM qa_user_profile_20261028.user_profile;
    IF v_count <> 8 THEN RAISE EXCEPTION 'QA expected 8 profiles during test, got %', v_count; END IF;

    -- Fill ONLY missing avatars, using JSONB semantic conversion.
    -- Never overwrite non-NULL canonical avatar configuration.
    UPDATE qa_user_profile_20261028.user_profile p
      SET avatar_config=u.avatar_config::jsonb, updated_at=now()
    FROM qa_user_profile_20261028.users u
    WHERE p.user_id=u.id AND p.avatar_config IS NULL AND u.avatar_config IS NOT NULL
      AND pg_input_is_valid(u.avatar_config,'jsonb');
    GET DIAGNOSTICS v_avatar_first = ROW_COUNT;
    UPDATE qa_user_profile_20261028.user_profile p
      SET avatar_config=u.avatar_config::jsonb, updated_at=now()
    FROM qa_user_profile_20261028.users u
    WHERE p.user_id=u.id AND p.avatar_config IS NULL AND u.avatar_config IS NOT NULL
      AND pg_input_is_valid(u.avatar_config,'jsonb');
    GET DIAGNOSTICS v_avatar_second = ROW_COUNT;
    IF v_avatar_first <> 1 OR v_avatar_second <> 0 THEN
      RAISE EXCEPTION 'Avatar full backfill not idempotent %, %', v_avatar_first,v_avatar_second;
    END IF;

    -- New synthetic politician profile keeps degree, avatar, and birth date.
    SELECT grado_elezione,avatar_config,data_nascita INTO v_grade,v_avatar,v_birth
    FROM qa_user_profile_20261028.user_profile
    WHERE user_id='00000000-0000-4000-8000-000000000103';
    IF v_grade <> 'CO' OR v_avatar IS DISTINCT FROM '{"hat":"gold"}'::jsonb
      OR v_birth <> DATE '1970-01-01' THEN
      RAISE EXCEPTION 'New synthetic politician profile lost data';
    END IF;

    -- Canonical profile's conflicting grade must NEVER be overwritten.
    SELECT grado_elezione INTO v_grade FROM qa_user_profile_20261028.user_profile
    WHERE user_id='00000000-0000-4000-8000-000000000106';
    IF v_grade <> 'R' THEN RAISE EXCEPTION 'Ambiguous politician grade overwritten'; END IF;
    SELECT comune_residenza INTO v_municipality FROM qa_user_profile_20261028.user_profile
    WHERE user_id='00000000-0000-4000-8000-000000000102';
    IF v_municipality <> 'Roma' THEN RAISE EXCEPTION 'Canonical residence overwritten'; END IF;
    SELECT avatar_config INTO v_avatar FROM qa_user_profile_20261028.user_profile
    WHERE user_id='00000000-0000-4000-8000-000000000108';
    IF v_avatar IS DISTINCT FROM '{"emoji":"cat"}'::jsonb THEN
      RAISE EXCEPTION 'Canonical avatar overwritten';
    END IF;
    SELECT avatar_config INTO v_avatar FROM qa_user_profile_20261028.user_profile
    WHERE user_id='00000000-0000-4000-8000-000000000107';
    IF v_avatar IS DISTINCT FROM '{"cat":"pixel"}'::jsonb THEN
      RAISE EXCEPTION 'Legacy-only avatar was not recovered';
    END IF;

    -- Backfill must never create/modify verified or official memberships.
    SELECT COUNT(*) INTO v_official_after FROM qa_user_profile_20261028.user_political_territories
      WHERE source <> 'legacy_profile';
    IF v_official_before <> v_official_after THEN
      RAISE EXCEPTION 'Political official/verified membership changed during profile backfill';
    END IF;

    -- Explicit rollback of every candidate DML statement.
    RAISE EXCEPTION 'QA_FULL_PROFILE_ROLLBACK_MARKER';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'QA_FULL_PROFILE_ROLLBACK_MARKER' THEN RAISE; END IF;
  END;

  SELECT COUNT(*) INTO v_count FROM qa_user_profile_20261028.user_profile;
  IF v_count <> 7 THEN RAISE EXCEPTION 'QA rollback leaked user_profile rows'; END IF;
  SELECT avatar_config INTO v_avatar FROM qa_user_profile_20261028.user_profile
  WHERE user_id='00000000-0000-4000-8000-000000000107';
  IF v_avatar IS NOT NULL THEN RAISE EXCEPTION 'QA rollback leaked avatar update'; END IF;
  SELECT COUNT(*) INTO v_official_after FROM qa_user_profile_20261028.user_political_territories
      WHERE source <> 'legacy_profile';
  IF v_official_before <> v_official_after THEN
    RAISE EXCEPTION 'QA rollback affected official territories';
  END IF;
END $qa$;
