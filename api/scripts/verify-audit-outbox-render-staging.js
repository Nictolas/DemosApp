'use strict';

// Execute explicitly in an isolated, feature-disabled Render staging runtime.
// No SQL mutations, Axiom requests, B2 reads/writes, tokens, or log payloads.
(async () => {
  try {
    const { runRenderStagingReadiness } =
      require('../services/auditOutboxRenderStagingReadiness');
    const result = await runRenderStagingReadiness();
    console.log(JSON.stringify(result));
  } catch (_error) {
    // Driver exceptions and environment values must never reach Render logs.
    console.error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
    process.exitCode = 1;
  }
})();
