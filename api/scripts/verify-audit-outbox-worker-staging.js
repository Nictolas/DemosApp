'use strict';
// Standalone CLI, NEVER imported by the API or used as a background service.
const { runStagingWorkerDrill } = require('../services/auditOutboxStagingWorkerDrill');

if (require.main === module) {
  runStagingWorkerDrill().then(result => {
    // Fixed status/counts only. No token, URL, SQL or event identifiers.
    process.stdout.write(JSON.stringify(result) + '\n');
  }).catch(_error => {
    process.stderr.write('STAGING_WORKER_OUTBOX_AXIOM_E2E_NOT_VERIFIED\n');
    process.exitCode = 1;
  });
}
