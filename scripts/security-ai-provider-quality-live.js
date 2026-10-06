const { runLiveAiProviderQuality } = require('../api/security-agent/securityAiLiveQualityRunner');

async function main({ env = process.env, logger = console } = {}) {
  const result = await runLiveAiProviderQuality({ env });
  if (logger && typeof logger.log === 'function') logger.log(JSON.stringify(result));
  if (result.status === 'disabled') return 0;
  if (result.status === 'accepted') return 0;
  return 2;
}

if (require.main === module) {
  main().then(code => {
    process.exitCode = code;
  }).catch(() => {
    console.error(JSON.stringify({
      version: 'v0.82',
      status: 'error',
      errorCode: 'AI_LIVE_QUALITY_CLI_FAILED',
      executable: false,
      toolCalls: []
    }));
    process.exitCode = 2;
  });
}

module.exports = { main };
