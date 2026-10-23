'use strict';

const { runAxiomStagingProviderDrill } =
  require('../services/axiomStagingProviderDrill');

if (require.main === module) {
  runAxiomStagingProviderDrill().then(result => {
    // Only aggregate categorical status, never the token or event UUID.
    console.log(JSON.stringify(result));
  }).catch(() => {
    console.error('AXIOM_STAGING_PROVIDER_E2E_NOT_VERIFIED');
    process.exitCode = 1;
  });
}

module.exports = { runAxiomStagingProviderDrill };
