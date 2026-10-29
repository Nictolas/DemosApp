-- DEMOS synthetic QA contract — staging ONLY, no production data.
-- All fixture changes in the revocation scenario are rolled back.
DO $QA$
DECLARE table_count integer; column_count integer; constraint_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema='qa_profile_contract_20261029' AND table_type='BASE TABLE';
  SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_schema='qa_profile_contract_20261029';
  SELECT COUNT(*) INTO constraint_count FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='qa_profile_contract_20261029';
  IF table_count <> 10 OR column_count <> 287 OR constraint_count <> 27 THEN
    RAISE EXCEPTION 'QA schema parity mismatch: tables %, columns %, constraints %', table_count, column_count, constraint_count;
  END IF;
  IF has_schema_privilege('anon','qa_profile_contract_20261029','USAGE')
     OR has_schema_privilege('authenticated','qa_profile_contract_20261029','USAGE') THEN
    RAISE EXCEPTION 'QA schema is unexpectedly exposed to public API roles';
  END IF;
  IF (SELECT COUNT(*) FROM qa_profile_contract_20261029.users) <> 2
     OR (SELECT COUNT(*) FROM qa_profile_contract_20261029.user_profile) <> 2
     OR (SELECT COUNT(*) FROM qa_profile_contract_20261029.user_consents) <> 2
     OR (SELECT COUNT(*) FROM qa_profile_contract_20261029.opinioni_risposte) <> 1 THEN
    RAISE EXCEPTION 'Fixture cardinality mismatch';
  END IF;
  IF (SELECT COUNT(*) FROM public.users) <> 2 THEN
    RAISE EXCEPTION 'Existing staging public user count changed; investigate before continuing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM qa_profile_contract_20261029.opinioni_risposte r
    JOIN qa_profile_contract_20261029.users u ON u.id=r.user_id
    LEFT JOIN qa_profile_contract_20261029.user_consents uc ON uc.user_id=u.id
    WHERE u.id='00000000-0000-4000-8000-000000000101'
      AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE
  ) THEN
    RAISE EXCEPTION 'Consent-gated synthetic opinion read missing before revocation';
  END IF;
END
$QA$;
BEGIN;
UPDATE qa_profile_contract_20261029.users SET political_opinions_consent=false
 WHERE id='00000000-0000-4000-8000-000000000101';
UPDATE qa_profile_contract_20261029.user_consents SET political_opinions_consent=false,political_opinions_consent_timestamp=null
 WHERE user_id='00000000-0000-4000-8000-000000000101';
DO $QA$
BEGIN
  IF EXISTS (
    SELECT 1 FROM qa_profile_contract_20261029.opinioni_risposte r
    JOIN qa_profile_contract_20261029.users u ON u.id=r.user_id
    LEFT JOIN qa_profile_contract_20261029.user_consents uc ON uc.user_id=u.id
    WHERE u.id='00000000-0000-4000-8000-000000000101'
      AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE
  ) THEN
    RAISE EXCEPTION 'Revoked synthetic opinion still authorized';
  END IF;
END
$QA$;
ROLLBACK;
-- Confirm that the QA fixture was not permanently altered by the test.
SELECT 'QA_PROFILE_CONTRACT_OK' AS result,
 (SELECT COUNT(*) FROM qa_profile_contract_20261029.users) AS synthetic_users,
 (SELECT political_opinions_consent FROM qa_profile_contract_20261029.user_consents
  WHERE user_id='00000000-0000-4000-8000-000000000101') AS granted_after_rollback;