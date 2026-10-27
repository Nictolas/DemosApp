'use strict';

const { assertIsolatedStagingEnvironment } = require('./isolatedStagingGuard');

// Use ONLY as an explicitly reviewed Render staging start command:
//   cd api && node staging/isolatedStagingServer.js
// Never change production's normal "node index.js" start command.
function startIsolatedStaging({ env = process.env, launch = () => require('../server') } = {}) {
  // This MUST complete before loading server/app/database, Firebase or jobs.
  const attestation = assertIsolatedStagingEnvironment(env);
  launch();
  return attestation;
}

if (require.main === module) {
  try {
    startIsolatedStaging();
  } catch (_) {
    // Fixed message: never print a rejected connection string or env value.
    console.error('DEMOS_STAGING_BOOT_REJECTED');
    process.exitCode = 1;
  }
}

module.exports = { startIsolatedStaging };
