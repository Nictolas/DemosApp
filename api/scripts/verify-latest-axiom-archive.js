// Read-only archive recovery drill: no PUT, no Axiom query, no checkpoint writes.
// This script intentionally prints only counts/times, never raw archived events.
const { AxiomArchiveService } = require('../services/axiomArchiveService');

(async () => {
  const dataset = process.argv[2];
  if (!dataset) {
    console.error('Usage: node scripts/verify-latest-axiom-archive.js <dataset>');
    process.exitCode = 2;
    return;
  }

  try {
    const service = new AxiomArchiveService();
    const summary = await service.verifyLatestArchiveBatch(dataset);
    console.log(JSON.stringify(summary, null, 2));
  } catch (_error) {
    // Object keys and provider error descriptions should not appear in logs.
    console.error('ARCHIVE_RESTORE_VERIFICATION_FAILED');
    process.exitCode = 1;
  }
})();
