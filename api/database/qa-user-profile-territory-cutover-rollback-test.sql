-- Isolated transactional dry run. Every write and DDL statement is rolled back
-- by the inner PL/pgSQL exception subtransaction. Synthetic rows only.
-- The canonical trigger is tested as a future migration candidate, NOT deployed.
DO $qa$
DECLARE
  v_count int;
  v_legacy text;
  v_profile text;
  v_read text;
BEGIN
  IF to_regclass('qa_user_profile_20261028.user_political_territories') IS NULL THEN
    RAISE EXCEPTION 'QA territory fixture missing';
  END IF;
  BEGIN
    INSERT INTO qa_user_profile_20261028.user_political_territories
      (user_id,jurisdiction_id,territory_type,territory_code,source,verification_level)
    VALUES
      ('00000000-0000-4000-8000-000000000101','it','REGION','LA','verified_registry','VERIFIED'),
      ('00000000-0000-4000-8000-000000000101','it','MUNICIPALITY','Roma','official_registry','OFFICIAL');

    -- Production-like legacy trigger follows users, but NOT changes to user_profile.
    UPDATE qa_user_profile_20261028.users
       SET paese_residenza='it',regione_residenza='TO',comune_residenza='Lucca'
     WHERE id='00000000-0000-4000-8000-000000000101';
    SELECT territory_code INTO v_legacy
      FROM qa_user_profile_20261028.user_political_territories
     WHERE user_id='00000000-0000-4000-8000-000000000101'
       AND source='legacy_profile' AND territory_type='MUNICIPALITY';
    IF v_legacy <> 'Lucca' THEN RAISE EXCEPTION 'Legacy trigger failed: %',v_legacy; END IF;

    UPDATE qa_user_profile_20261028.user_profile SET comune_residenza='Roma'
     WHERE user_id='00000000-0000-4000-8000-000000000101';
    SELECT territory_code INTO v_legacy
      FROM qa_user_profile_20261028.user_political_territories
     WHERE user_id='00000000-0000-4000-8000-000000000101'
       AND source='legacy_profile' AND territory_type='MUNICIPALITY';
    IF v_legacy <> 'Lucca' THEN
      RAISE EXCEPTION 'Expected proof of unsynced profile-only write, got %',v_legacy;
    END IF;

    -- Future cutover must switch trigger ownership atomically (QA schema only).
    DROP TRIGGER qa_users_sync_political_territories ON qa_user_profile_20261028.users;
    CREATE TRIGGER qa_profile_sync_political_territories
      AFTER INSERT OR UPDATE OF paese_residenza,regione_residenza,provincia_residenza,comune_residenza
      ON qa_user_profile_20261028.user_profile
      FOR EACH ROW EXECUTE FUNCTION qa_user_profile_20261028.sync_canonical_residence_territories();

    UPDATE qa_user_profile_20261028.user_profile
       SET paese_residenza='it',regione_residenza='TO',comune_residenza='Firenze'
     WHERE user_id='00000000-0000-4000-8000-000000000101';
    SELECT territory_code INTO v_profile
      FROM qa_user_profile_20261028.user_political_territories
     WHERE user_id='00000000-0000-4000-8000-000000000101'
       AND source='legacy_profile' AND territory_type='MUNICIPALITY';
    IF v_profile <> 'Firenze' THEN RAISE EXCEPTION 'Canonical trigger failed: %',v_profile; END IF;

    SELECT count(*) INTO v_count
      FROM qa_user_profile_20261028.user_political_territories
     WHERE user_id='00000000-0000-4000-8000-000000000101'
       AND ((source='verified_registry' AND territory_code='LA' AND verification_level='VERIFIED')
         OR (source='official_registry' AND territory_code='Roma' AND verification_level='OFFICIAL'));
    IF v_count <> 2 THEN RAISE EXCEPTION 'Verified/official political territory was lost'; END IF;

    -- Explicit removal must really clear the self-declared municipality.
    UPDATE qa_user_profile_20261028.user_profile SET comune_residenza=NULL
     WHERE user_id='00000000-0000-4000-8000-000000000101';
    SELECT count(*) INTO v_count
      FROM qa_user_profile_20261028.user_political_territories
     WHERE user_id='00000000-0000-4000-8000-000000000101'
       AND source='legacy_profile' AND territory_type='MUNICIPALITY';
    IF v_count <> 0 THEN RAISE EXCEPTION 'Explicit NULL still has legacy membership'; END IF;

    SELECT COALESCE(p.comune_residenza,u.comune_residenza) INTO v_read
      FROM qa_user_profile_20261028.users u
      JOIN qa_user_profile_20261028.user_profile p ON p.user_id=u.id
     WHERE u.id='00000000-0000-4000-8000-000000000101';
    IF v_read <> 'Lucca' THEN
      RAISE EXCEPTION 'Expected current COALESCE reader to incorrectly resurrect legacy value';
    END IF;
    SELECT CASE WHEN p.user_id IS NOT NULL THEN p.comune_residenza ELSE u.comune_residenza END INTO v_read
      FROM qa_user_profile_20261028.users u
      LEFT JOIN qa_user_profile_20261028.user_profile p ON p.user_id=u.id
     WHERE u.id='00000000-0000-4000-8000-000000000101';
    IF v_read IS NOT NULL THEN RAISE EXCEPTION 'Strict owner reader failed to preserve NULL'; END IF;

    RAISE EXCEPTION 'QA_TERRITORY_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'QA_TERRITORY_ROLLBACK' THEN RAISE; END IF;
  END;

  -- All state and trigger DDL must revert to pre-test fixture.
  SELECT count(*) INTO v_count
    FROM qa_user_profile_20261028.user_political_territories
   WHERE user_id='00000000-0000-4000-8000-000000000101';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Rollback leaked membership rows: %',v_count; END IF;
  SELECT count(*) INTO v_count FROM pg_trigger t
     JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='qa_user_profile_20261028' AND t.tgname='qa_users_sync_political_territories' AND NOT t.tgisinternal;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Rollback failed to restore users trigger'; END IF;
  SELECT count(*) INTO v_count FROM pg_trigger t
     JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='qa_user_profile_20261028' AND t.tgname='qa_profile_sync_political_territories' AND NOT t.tgisinternal;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Rollback failed to remove canonical test trigger'; END IF;
END $qa$;
