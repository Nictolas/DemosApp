'use strict';

// Read-only preflight for the dedicated Supabase DEMOS staging DB.
// No events are selected or written, and no provider credentials are used.
(async () => {
  try {
    const { runStagingOutboxPreflight } = require('../services/auditOutboxStagingGuard');
    const report = await runStagingOutboxPreflight();
    console.log(JSON.stringify({
      result: 'STAGING_OUTBOX_PREFLIGHT_OK',
      stagingRef: report.stagingRef,
      roleAuthorized: report.roleAuthorized,
      readOnly: report.readOnly
    }));
  } catch (_error) {
    // Do not print errors that may embed the credential or connection URL.
    console.error('STAGING_OUTBOX_PREFLIGHT_REJECTED');
    process.exitCode = 1;
  }
})();
