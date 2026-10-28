-- DEMOS staging QA: deterministic test over invented rows only.
-- The nested BEGIN/EXCEPTION creates a subtransaction that rolls back all test writes.
-- No real user data or public table is accessed or modified.
DO $qa$
DECLARE
  first_backfill integer;
  second_backfill integer;
  profile_count integer;
  resolved_comune text;
  avatar_before jsonb;
  avatar_after jsonb;
BEGIN
  SELECT count(*) INTO profile_count FROM qa_user_profile_20261028.user_profile;
  IF profile_count <> 7 THEN RAISE EXCEPTION 'QA initial profile count: %', profile_count; END IF;

  BEGIN
    INSERT INTO qa_user_profile_20261028.user_profile
       (user_id, cittadinanza, regione_residenza, provincia_residenza, comune_residenza, data_nascita, avatar_config, grado_elezione)
    SELECT u.id, u.cittadinanza, u.regione_residenza, u.provincia_residenza, u.comune_residenza,
           u.data_nascita, CASE WHEN pg_input_is_valid(u.avatar_config,'jsonb') THEN u.avatar_config::jsonb ELSE NULL END, u.grado_elezione
      FROM qa_user_profile_20261028.users u
     WHERE NOT EXISTS (SELECT 1 FROM qa_user_profile_20261028.user_profile p WHERE p.user_id=u.id)
    ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS first_backfill = ROW_COUNT;

    INSERT INTO qa_user_profile_20261028.user_profile
       (user_id, cittadinanza, regione_residenza, provincia_residenza, comune_residenza, data_nascita, avatar_config, grado_elezione)
    SELECT u.id, u.cittadinanza, u.regione_residenza, u.provincia_residenza, u.comune_residenza,
           u.data_nascita, CASE WHEN pg_input_is_valid(u.avatar_config,'jsonb') THEN u.avatar_config::jsonb ELSE NULL END, u.grado_elezione
      FROM qa_user_profile_20261028.users u
     WHERE NOT EXISTS (SELECT 1 FROM qa_user_profile_20261028.user_profile p WHERE p.user_id=u.id)
    ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS second_backfill = ROW_COUNT;
    IF first_backfill <> 1 OR second_backfill <> 0 THEN
      RAISE EXCEPTION 'QA backfill not idempotent: %, %', first_backfill, second_backfill;
    END IF;

    SELECT count(*) INTO profile_count FROM qa_user_profile_20261028.user_profile;
    IF profile_count <> 8 THEN RAISE EXCEPTION 'QA expected eight profiles in subtransaction: %', profile_count; END IF;

    -- An admin-style edit must atomically update both tables.
    UPDATE qa_user_profile_20261028.users
       SET comune_residenza='Lucca', updated_at=now()
     WHERE id='00000000-0000-4000-8000-000000000101';
    INSERT INTO qa_user_profile_20261028.user_profile(user_id,comune_residenza)
      VALUES ('00000000-0000-4000-8000-000000000101','Lucca')
      ON CONFLICT(user_id) DO UPDATE SET comune_residenza=excluded.comune_residenza,updated_at=now();
    SELECT COALESCE(p.comune_residenza,u.comune_residenza) INTO resolved_comune
      FROM qa_user_profile_20261028.users u
      JOIN qa_user_profile_20261028.user_profile p ON p.user_id=u.id
     WHERE u.id='00000000-0000-4000-8000-000000000101';
    IF resolved_comune<>'Lucca' THEN RAISE EXCEPTION 'QA profile mirror mismatch: %',resolved_comune; END IF;

    -- Invalid avatar JSON must fail without leaving the users mirror modified.
    SELECT avatar_config INTO avatar_before FROM qa_user_profile_20261028.user_profile
     WHERE user_id='00000000-0000-4000-8000-000000000101';
    BEGIN
      UPDATE qa_user_profile_20261028.users SET avatar_config='{invalid json' WHERE id='00000000-0000-4000-8000-000000000101';
      UPDATE qa_user_profile_20261028.user_profile SET avatar_config='{invalid json'::jsonb
      WHERE user_id='00000000-0000-4000-8000-000000000101';
      RAISE EXCEPTION 'QA invalid avatar accepted';
    EXCEPTION WHEN invalid_text_representation THEN
      NULL; -- Expected failure; nested subtransaction restores both tables.
    END;
    SELECT avatar_config INTO avatar_after FROM qa_user_profile_20261028.user_profile
     WHERE user_id='00000000-0000-4000-8000-000000000101';
    IF avatar_after IS DISTINCT FROM avatar_before THEN
      RAISE EXCEPTION 'QA avatar rollback not atomic';
    END IF;

    -- Simulate a caller rolling back after successful operations.
    RAISE EXCEPTION 'QA_TEST_ROLLBACK_MARKER';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'QA_TEST_ROLLBACK_MARKER' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO profile_count FROM qa_user_profile_20261028.user_profile;
  IF profile_count <> 7 THEN RAISE EXCEPTION 'QA rollback did not restore profile count: %',profile_count; END IF;
  SELECT u.comune_residenza INTO resolved_comune FROM qa_user_profile_20261028.users u
   WHERE u.id='00000000-0000-4000-8000-000000000101';
  IF resolved_comune <> 'Pisa' THEN RAISE EXCEPTION 'QA rollback did not restore municipality: %',resolved_comune; END IF;
END
$qa$;
