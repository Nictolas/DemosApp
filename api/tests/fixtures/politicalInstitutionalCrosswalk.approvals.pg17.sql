-- Synthetic approvals on disposable PostgreSQL 17 ONLY.
-- Administrative INSERTs in this file are test fixtures, NOT a model for granting
-- the application any write privileges to the private approvals table.
INSERT INTO demos_internal.approved_political_mandate_imports
  (institution,official_id,legislature,starts_on,ends_on,
   user_id,source_url,review_reference,reviewed_by)
VALUES
  ('CAMERA','d456_17',17,DATE '2013-03-15',DATE '2018-03-22',
   '11111111-1111-4111-8111-111111111111',
   'https://dati.camera.it/ocd/deputato.rdf/d456_17',
   'POL-015-review-001','reviewer-fixture'),
  ('CAMERA','d456_17',18,DATE '2019-03-15',DATE '2022-03-22',
   '22222222-2222-4222-8222-222222222222',
   'https://dati.camera.it/ocd/deputato.rdf/d456_17',
   'POL-015-review-collision','reviewer-fixture'),
  ('SENATO','sen-456',19,DATE '2022-10-13',NULL,
   '11111111-1111-4111-8111-111111111111',
   'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=456',
   'POL-015-review-002','reviewer-fixture'),
  ('CAMERA','d456_19',19,DATE '2023-01-01',NULL,
   '11111111-1111-4111-8111-111111111111',
   'https://www.camera.it/deputati/elenco/19-456',
   'POL-015-review-003','reviewer-fixture'),
  ('CAMERA','d456_18',18,DATE '2017-03-01',DATE '2018-03-22',
   '11111111-1111-4111-8111-111111111111',
   'https://dati.camera.it/ocd/deputato.rdf/d456_18',
   'POL-015-review-003b','reviewer-fixture'),
  ('SENATO','rollback-fixture',19,DATE '2022-10-13',NULL,
   '22222222-2222-4222-8222-222222222222',
   'https://www.senato.it/composizione/senatori/scheda?did=rollback',
   'POL-015-review-rb01','reviewer-fixture'),
  ('SENATO','parallel-fixture',19,DATE '2022-10-13',NULL,
   '22222222-2222-4222-8222-222222222222',
   'https://www.senato.it/composizione/senatori/scheda?did=parallel',
   'POL-015-review-parallel','reviewer-fixture');
