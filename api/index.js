'use strict';

// Render entrypoint: a staging identity probe MUST validate the service ID,
// database project and TLS before any app module, worker, timer or SQL pool
// can be imported. This does not attest other external provider credentials.
if (process.env.GDPR_RENDER_INPROCESS_ATTESTATION !== undefined) {
  try {
    require('./services/gdprRenderInProcessStagingAttestation')
      .assertProcessTarget(process.env);
  } catch (_) {
    // Never print DATABASE_URL or the original error.
    throw Error('GDPR_RENDER_STAGING_PREFLIGHT_REFUSED');
  }
}

require('./server');
