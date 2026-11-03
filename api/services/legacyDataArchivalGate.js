'use strict';

/**
 * Fail closed for abandoned hard-disk/cron PostgreSQL log archival scripts.
 *
 * The old data-archival-strategy.js "uploadToArchive" function only prints
 * a simulated upload and returns a fabricated receipt, while subsequent
 * code can DELETE rows. The hard-disk exporter also supports --delete.
 *
 * No runtime flag or environment variable can re-enable these paths.
 * The approved Axiom -> B2 archive implementation is separate and unaffected.
 */
const CODE = 'LEGACY_DATA_ARCHIVAL_RETIRED';
const MESSAGE = 'Archiviazione legacy con eliminazione dati disabilitata: necessario backup verificabile, retention GDPR e revisione separata';

function assertLegacyDataArchivalUnavailable() {
  const error = new Error(MESSAGE);
  error.code = CODE;
  throw error;
}

function exitRetiredLegacyDataArchival() {
  process.stderr.write(CODE + ': ' + MESSAGE + '\n');
  process.exit(78);
}

module.exports = {
  CODE,
  assertLegacyDataArchivalUnavailable,
  exitRetiredLegacyDataArchival
};
