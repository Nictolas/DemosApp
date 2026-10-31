'use strict';

/**
 * Temporary fail-closed gate for old Neon -> Axiom bulk migration tools.
 *
 * The legacy mapping can include email, user IDs, IPs and free-form log
 * details, and relied on optional anonymization. This gate is intentionally
 * not configurable by environment variables or CLI flags: re-enabling data
 * transfer requires a separately reviewed implementation and retention plan.
 *
 * Ordinary application logging, Axiom ingest and B2 retention are not changed.
 */
const CODE = 'LEGACY_AXIOM_MIGRATION_RETIRED';
const MESSAGE = 'Migrazione massiva legacy Neon verso Axiom sospesa in attesa di revisione GDPR, minimizzazione e retention';

function assertLegacyAxiomMigrationUnavailable() {
  const error = new Error(MESSAGE);
  error.code = CODE;
  throw error;
}

function exitRetiredLegacyAxiomMigration() {
  process.stderr.write(CODE + ': ' + MESSAGE + '\n');
  process.exit(78);
}

module.exports = {
  CODE,
  assertLegacyAxiomMigrationUnavailable,
  exitRetiredLegacyAxiomMigration
};
