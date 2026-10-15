const { runPhase4DeployedValidation } = require('../api/security-agent/securityPhase4DeployedValidation');

async function main({ env = process.env, logger = console } = {}) {
  const result = await runPhase4DeployedValidation({ env });
  if (logger && typeof logger.log === 'function') logger.log(JSON.stringify(result));
  return ['disabled', 'accepted'].includes(result.status) ? 0 : 2;
}

if (require.main === module) {
  main().then(code => { process.exitCode = code; }).catch(() => {
    console.error(JSON.stringify({ version: 'v0.85', status: 'error', errorCode: 'PHASE4_DEPLOYED_VALIDATION_CLI_FAILED', authorized: false, executable: false, actionRunnerAvailable: false }));
    process.exitCode = 2;
  });
}

module.exports = { main };
