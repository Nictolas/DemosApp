-- RETIRED / DO NOT EXECUTE — DEMOS parliamentary identity safety
-- This historical file inserted a new politician users row for a distinct
-- grado_elezione ('C' or 'S'), even when a profile representing the same
-- person existed for another chamber or a previous parliamentary term.
-- Matching on given name and surname, birth date or chamber alone is not
-- proof of identity. Reusing this file can inflate statistics and fabricate
-- simultaneous parliamentary offices.
--
-- Git history preserves the prior import data for review.
-- Importers must link verified institutional identity IDs to one canonical
-- user_id and create dated mandates, not duplicate users.
-- Tracking: https://github.com/Nictolas/DemosApp/issues/396
-- No INSERT, UPDATE or DELETE statements are executed by this file.
DO $retired_parliamentary_import$
BEGIN
  RAISE EXCEPTION 'Unsafe legacy parliamentary users importer retired. Use identity-first verified mandate importer; see issue #396.';
END
$retired_parliamentary_import$;
