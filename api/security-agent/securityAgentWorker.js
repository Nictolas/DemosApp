const { createSecurityAgentRuntime } = require('./securityAgentRuntime');

function safeLog(logger, payload) {
  const out = JSON.stringify(payload);
  if (logger && typeof logger.log === 'function') logger.log(out);
}

async function runSecurityAgentWorker({ env = process.env, logger = console, runtimeFactory = createSecurityAgentRuntime } = {}) {
  const runtime = runtimeFactory({ env });
  const initial = runtime.status();
  safeLog(logger, {
    component: 'demos-security-agent',
    event: 'boot',
    state: initial.state,
    mode: initial.mode,
    blockers: initial.blockers
  });

  if (!runtime.start()) {
    safeLog(logger, {
      component: 'demos-security-agent',
      event: 'not_started',
      state: runtime.status().state
    });
    return { runtime, started: false, shutdown: async () => runtime.stop() };
  }

  let shuttingDown = false;
  const shutdown = async signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    safeLog(logger, { component: 'demos-security-agent', event: 'shutdown', signal: String(signal || 'manual').slice(0, 16) });
    await runtime.stop();
  };

  return { runtime, started: true, shutdown };
}

async function main() {
  const worker = await runSecurityAgentWorker();
  if (!worker.started) return;

  const onTerm = async signal => {
    await worker.shutdown(signal);
    process.exitCode = 0;
  };
  process.once('SIGTERM', () => { onTerm('SIGTERM').catch(() => { process.exitCode = 1; }); });
  process.once('SIGINT', () => { onTerm('SIGINT').catch(() => { process.exitCode = 1; }); });
}

if (require.main === module) {
  main().catch(() => {
    console.error(JSON.stringify({ component: 'demos-security-agent', event: 'fatal', errorCode: 'SECURITY_WORKER_BOOT_FAILED' }));
    process.exitCode = 1;
  });
}

module.exports = { runSecurityAgentWorker, main };
