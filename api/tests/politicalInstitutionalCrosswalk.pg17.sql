-- Synthetic data, PostgreSQL 17, disposable database, no Supabase connection.
DO $test$
DECLARE
  first JSONB;
  again JSONB;
  second JSONB;
  before_users INT;
  before_mandates INT;
  before_links INT;
  err TEXT;
BEGIN
  SELECT COUNT(*) INTO before_users FROM public.users;

  -- Free-form review_reference/reviewed_by are NOT sufficient: require an
  -- independently inserted, exact-match row in the private approval table.
  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '22222222-2222-4222-8222-222222222222','SENATO','90007',19,
      DATE '2022-10-13',NULL,
      'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=90007',
      'POL-015-unapproved','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_APPROVAL_REQUIRED_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'MANUAL_APPROVAL_NOT_FOUND_OR_MISMATCHED' THEN RAISE; END IF;
  END;

  -- An approved ID still cannot be used with another reviewer's declaration.
  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '11111111-1111-4111-8111-111111111111','CAMERA','d456_17',17,
      DATE '2013-03-15',DATE '2018-03-22',
      'https://dati.camera.it/ocd/deputato.rdf/d456_17',
      'POL-015-review-001','reviewer-spoof'
    );
    RAISE EXCEPTION 'EXPECTED_APPROVAL_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'MANUAL_APPROVAL_NOT_FOUND_OR_MISMATCHED' THEN RAISE; END IF;
  END;

  SELECT demos_internal.import_official_political_mandate(
    '11111111-1111-4111-8111-111111111111','CAMERA','d456_17',17,
    DATE '2013-03-15',DATE '2018-03-22',
    'https://dati.camera.it/ocd/deputato.rdf/d456_17',
    'POL-015-review-001','reviewer-fixture'
  ) INTO first;
  IF first->>'outcome' <> 'inserted' THEN RAISE EXCEPTION 'first insert failed'; END IF;

  SELECT demos_internal.import_official_political_mandate(
    '11111111-1111-4111-8111-111111111111','CAMERA','d456_17',17,
    DATE '2013-03-15',DATE '2018-03-22',
    'https://dati.camera.it/ocd/deputato.rdf/d456_17',
    'POL-015-review-001','reviewer-fixture'
  ) INTO again;
  IF again->>'outcome' <> 'unchanged' OR first->>'mandate_id' <> again->>'mandate_id'
  THEN RAISE EXCEPTION 'retry not idempotent'; END IF;

  SELECT demos_internal.import_official_political_mandate(
    '11111111-1111-4111-8111-111111111111','SENATO','456',19,
    DATE '2022-10-13',NULL,
    'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=000456',
    'POL-015-review-002','reviewer-fixture'
  ) INTO second;
  IF second->>'outcome' <> 'inserted' THEN RAISE EXCEPTION 'senate insert failed'; END IF;

  IF (SELECT count(*) FROM public.users) <> before_users
     OR (SELECT COUNT(*) FROM public.political_mandates WHERE source='OFFICIAL_VERIFIED') <> 2
     OR (SELECT COUNT(*) FROM demos_internal.official_political_identities) <> 2
     OR (SELECT COUNT(*) FROM demos_internal.official_political_mandate_links) <> 2
  THEN RAISE EXCEPTION 'row-count invariant violated'; END IF;

  -- The manual source dates, unlike backfill time, remain provenance-attributed.
  IF NOT EXISTS (
    SELECT 1 FROM public.political_mandates
    WHERE user_id='11111111-1111-4111-8111-111111111111'
      AND office_code='C' AND status='ENDED'
      AND source='OFFICIAL_VERIFIED' AND starts_at='2013-03-15T00:00:00Z'
      AND ends_at='2018-03-23T00:00:00Z'
      AND legacy_context->>'official_id'='d456_17'
  ) THEN RAISE EXCEPTION 'historical mandate provenance missing'; END IF;

  SELECT COUNT(*) INTO before_mandates FROM public.political_mandates;
  SELECT COUNT(*) INTO before_links FROM demos_internal.official_political_mandate_links;

  -- Collision: same official ID must never be assigned to a different user.
  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '22222222-2222-4222-8222-222222222222','CAMERA','d456_17',18,
      DATE '2019-03-15',DATE '2022-03-22',
      'https://dati.camera.it/ocd/deputato.rdf/d456_17',
      'POL-015-review-collision','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_COLLISION_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'OFFICIAL_IDENTITY_ALREADY_MAPPED_TO_DIFFERENT_USER' THEN RAISE; END IF;
  END;

  -- Official overlap with verified Senato; no second current Camera.
  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '11111111-1111-4111-8111-111111111111','CAMERA','d456_19',19,
      DATE '2023-01-01',NULL,
      'https://dati.camera.it/ocd/deputato.rdf/d456_19',
      'POL-015-review-003','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_OVERLAP_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'VERIFIED_CAMERA_SENATO_PERIOD_OVERLAP' THEN RAISE; END IF;
  END;

  -- A different verified mandate in the same chamber may not overlap.
  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '11111111-1111-4111-8111-111111111111','CAMERA','d456_18',18,
      DATE '2017-03-01',DATE '2018-03-22',
      'https://dati.camera.it/ocd/deputato.rdf/d456_18',
      'POL-015-review-003b','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_SAME_CHAMBER_OVERLAP_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'VERIFIED_SAME_CHAMBER_PERIOD_OVERLAP' THEN RAISE; END IF;
  END;

  -- Past institutional mandates must not use invented future end dates.
  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '22222222-2222-4222-8222-222222222222','SENATO','90006',19,
      DATE '2022-10-13',CURRENT_DATE + 1,
      'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=90006',
      'POL-015-review-003c','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_FUTURE_END_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'INVALID_MANDATE_DATES' THEN RAISE; END IF;
  END;

  -- Even a NEW manually approved correction may not rewrite an existing
  -- verified mandate silently. The test-only approval UPDATE is rolled back
  -- by the expected exception's plpgsql subtransaction.
  BEGIN
    UPDATE demos_internal.approved_political_mandate_imports
      SET ends_on = DATE '2018-03-23'
      WHERE institution='CAMERA' AND official_id='d456_17'
        AND legislature=17 AND starts_on=DATE '2013-03-15';
    PERFORM demos_internal.import_official_political_mandate(
      '11111111-1111-4111-8111-111111111111','CAMERA','d456_17',17,
      DATE '2013-03-15',DATE '2018-03-23',
      'https://dati.camera.it/ocd/deputato.rdf/d456_17',
      'POL-015-review-001','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_REVIEW_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'VERIFIED_MANDATE_CONFLICT_REQUIRES_REVIEW' THEN RAISE; END IF;
  END;

  -- Block malicious source look-alikes, wrong account types and future starts.
  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '22222222-2222-4222-8222-222222222222','SENATO','90003',19,
      DATE '2022-10-13',NULL,
      'https://www.senato.it.attacker.example/scheda',
      'POL-015-review-004','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_SPOOF_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'OFFICIAL_ID_SOURCE_MISMATCH' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '33333333-3333-4333-8333-333333333333','SENATO','90004',19,
      DATE '2022-10-13',NULL,
      'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=90004',
      'POL-015-review-005','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_ORGANIZATION_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'CANONICAL_PERSON_USER_NOT_FOUND' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM demos_internal.import_official_political_mandate(
      '22222222-2222-4222-8222-222222222222','SENATO','90005',19,
      CURRENT_DATE+1,NULL,
      'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=90004',
      'POL-015-review-006','reviewer-fixture'
    );
    RAISE EXCEPTION 'EXPECTED_FUTURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    IF err <> 'INVALID_MANDATE_DATES' THEN RAISE; END IF;
  END;

  IF (SELECT count(*) FROM public.political_mandates) <> before_mandates
     OR (SELECT count(*) FROM demos_internal.official_political_mandate_links) <> before_links
  THEN RAISE EXCEPTION 'rejected cases changed database'; END IF;

  -- The production trigger projects ruolo from ACTIVE mandates; these tests
  -- mirror that behavior and verify no accounts/flags were silently rewritten.
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id='11111111-1111-4111-8111-111111111111' AND ruolo='P'
      AND account_type='PERSON' AND is_admin=FALSE AND is_activist=FALSE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id='33333333-3333-4333-8333-333333333333'
      AND ruolo='O' AND account_type='ORGANIZATION'
  ) THEN
    RAISE EXCEPTION 'production-like role projection unexpectedly changed users';
  END IF;

  -- New schema and functions are not available to API anon/authenticated roles.
  IF has_table_privilege('anon',
       'demos_internal.approved_political_mandate_imports','SELECT')
    OR has_table_privilege('authenticated',
       'demos_internal.approved_political_mandate_imports','INSERT')
  THEN
    RAISE EXCEPTION 'manual approval table exposed to application roles';
  END IF;
  IF has_schema_privilege('anon','demos_internal','USAGE')
     OR has_schema_privilege('authenticated','demos_internal','USAGE') THEN
    RAISE EXCEPTION 'private schema leaked'; END IF;
  IF has_function_privilege('authenticated',
       'demos_internal.import_official_political_mandate(uuid,text,text,integer,date,date,text,text,text)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'import function publicly executable'; END IF;
  RAISE NOTICE 'PASS: idempotence, identity ownership, historical dates, overlap, rollback and ACL';
END;
$test$;

-- Prove rollback of a successful insertion, not only caught exceptions.
BEGIN;
SELECT demos_internal.import_official_political_mandate(
  '22222222-2222-4222-8222-222222222222','SENATO','90001',19,
  DATE '2022-10-13',NULL,
  'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=90001',
  'POL-015-review-rb01','reviewer-fixture'
);
ROLLBACK;

DO $rollback$
BEGIN
  IF EXISTS (SELECT 1 FROM demos_internal.official_political_identities
             WHERE official_id='90001')
     OR EXISTS (SELECT 1 FROM public.political_mandates
                WHERE legacy_context->>'official_id'='90001')
  THEN RAISE EXCEPTION 'transaction rollback failed'; END IF;
  RAISE NOTICE 'PASS: explicit transaction rollback';
END;
$rollback$;
