-- DEMOS isolated QA: verify ONLY the three synthetic profile/territory tables.
-- This does NOT certify complete GDPR erasure across DEMOS. No public data.
-- All changes are rolled back inside a PL/pgSQL subtransaction.
DO $qa$
DECLARE
  v_users integer;
  v_profiles integer;
  v_territories integer;
BEGIN
  SELECT count(*) INTO v_users FROM qa_user_profile_20261028.users;
  SELECT count(*) INTO v_profiles FROM qa_user_profile_20261028.user_profile;
  SELECT count(*) INTO v_territories FROM qa_user_profile_20261028.user_political_territories;
  IF v_users <> 8 OR v_profiles <> 7 OR v_territories <> 0 THEN
    RAISE EXCEPTION 'QA delete fixture changed before test';
  END IF;

  BEGIN
    -- Invented account 101 has an existing profile. Use unique source labels to
    -- verify that BOTH official and self-declared rows cascade upon account delete.
    INSERT INTO qa_user_profile_20261028.user_political_territories
      (user_id,jurisdiction_id,territory_type,territory_code,source,verification_level)
    VALUES
      ('00000000-0000-4000-8000-000000000101','it','REGION','TO','qa_verified','VERIFIED'),
      ('00000000-0000-4000-8000-000000000101','it','MUNICIPALITY','Pisa','qa_self','SELF_DECLARED');

    DELETE FROM qa_user_profile_20261028.users
    WHERE id='00000000-0000-4000-8000-000000000101';
    SELECT count(*) INTO v_users FROM qa_user_profile_20261028.users;
    SELECT count(*) INTO v_profiles FROM qa_user_profile_20261028.user_profile;
    SELECT count(*) INTO v_territories
      FROM qa_user_profile_20261028.user_political_territories
      WHERE user_id='00000000-0000-4000-8000-000000000101';
    IF v_users <> 7 OR v_profiles <> 6 OR v_territories <> 0 THEN
      RAISE EXCEPTION 'QA cascade deletion failed: %, %, %',v_users,v_profiles,v_territories;
    END IF;
    -- Unrelated account and its profile must be unaffected.
    SELECT count(*) INTO v_profiles
      FROM qa_user_profile_20261028.user_profile
      WHERE user_id='00000000-0000-4000-8000-000000000102';
    IF v_profiles <> 1 THEN RAISE EXCEPTION 'Unrelated profile unexpectedly erased'; END IF;
    RAISE EXCEPTION 'QA_DELETION_ROLLBACK_MARKER';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'QA_DELETION_ROLLBACK_MARKER' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO v_users FROM qa_user_profile_20261028.users;
  SELECT count(*) INTO v_profiles FROM qa_user_profile_20261028.user_profile;
  SELECT count(*) INTO v_territories FROM qa_user_profile_20261028.user_political_territories;
  IF v_users <> 8 OR v_profiles <> 7 OR v_territories <> 0 THEN
    RAISE EXCEPTION 'QA deletion rollback leaked changes: %, %, %',v_users,v_profiles,v_territories;
  END IF;
END $qa$;
