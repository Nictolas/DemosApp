'use strict';

// The Render WEB entrypoint must never execute SQL identity diagnostics:
// loading the backend also initializes Firebase, audit, monitoring and workers.
// The operator's isolated probe is a separate one-shot CLI command; never use
// its markers to redeploy or restart this web service.
if (process.env.GDPR_RENDER_INPROCESS_ATTESTATION !== undefined ||
    process.env.GDPR_RENDER_SQL_CLI_ONLY !== undefined) {
  throw Error('GDPR_RENDER_STAGING_WEB_PROBE_FORBIDDEN');
}

require('./server');
