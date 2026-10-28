-- RETIRED / DO NOT EXECUTE
-- Legacy parliament-import SQL used to INSERT INTO users when a politician was
-- missing in the SAME office (grado_elezione='S'), overlooking an existing
-- Camera or regional PERSON account. That created duplicate users and fictitious
-- simultaneous ACTIVE mandates from the LEGACY_BACKFILL process.
--
-- Superseded by identity-first verified importer (to be implemented; issue #396):
--   1. Resolve a unique institutional external identity against users;
--   2. Review conflicting names and dates of birth, do not infer an identity;
--   3. Reuse the same canonical user_id for a person's successive mandates;
--   4. Insert dated political_mandates with provenance, never another users row;
--   5. Abort if historical mandate cannot be verified.
--
-- This file intentionally has NO INSERT/UPDATE/DELETE statements.
-- Its historic contents remain recoverable from Git history.
DO $obsolete_import_guard$
BEGIN
  RAISE EXCEPTION 'Legacy Senate importer disabled: unsafe duplicate users creation. See DEMOS GitHub issue #396.';
END
$obsolete_import_guard$;
