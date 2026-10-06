const { runSecurityAgentWorker } = require('./securityAgentWorker');
const { startSecurityCenterStagingServer } = require('./securityCenterStagingServer');
const { createReadOnlySecurityCenterService } = require('./securityCenterMount');

const SECURITY_STAGING_STACK_VERSION = 'v0.94';

function stackError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function startSecurityStagingStack({
  env = process.env,
  workerStarter = runSecurityAgentWorker,
  serverStarter = startSecurityCenterStagingServer,
  serviceFactory = createReadOnlySecurityCenterService,
  logger = console
} = {}) {
  let worker = null;
  let server = null;

  try {
    if (env.SECURITY_AGENT_PROCESS_ENABLED === 'true') {
      worker = await workerStarter({ env, logger });
      if (!worker || worker.started !== true || !worker.runtime) {
        throw stackError('SECURITY_STAGING_WORKER_NOT_STARTED');
      }
    }

    const runtime = worker?.runtime || null;
    const runner = runtime?.runner || null;
    const store = runner?.store || null;
    const service = serviceFactory({ runtime, runner, store });
    server = serverStarter({ env, service });
  } catch (error) {
    if (server && typeof server.close === 'function') {
      try { server.close(); } catch (_closeError) {}
    }
    if (worker && typeof worker.shutdown === 'function') {
      try { await worker.shutdown('STARTUP_FAILED'); } catch (_shutdownError) {}
    }
    throw error;
  }

  let shuttingDown = false;
  const shutdown = async signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (server && typeof server.close === 'function') {
      await new Promise(resolve => server.close(() => resolve()));
    }
    if (worker && typeof worker.shutdown === 'function') await worker.shutdown(signal || 'manual');
  };

  return Object.freeze({
    version: SECURITY_STAGING_STACK_VERSION,
    server,
    worker,
    workerStarted: worker?.started === true,
    readOnly: true,
    databaseWriterAllowed: false,
    actionRunnerAvailable: false,
    executable: false,
    shutdown
  });
}

async function main() {
  const stack = await startSecurityStagingStack();
  const stop = async signal => {
    await stack.shutdown(signal);
    process.exitCode = 0;
  };
  process.once('SIGTERM', () => { stop('SIGTERM').catch(() => { process.exitCode = 1; }); });
  process.once('SIGINT', () => { stop('SIGINT').catch(() => { process.exitCode = 1; }); });
}

if (require.main === module) {
  main().catch(() => {
    console.error(JSON.stringify({
      component: 'demos-security-staging',
      event: 'fatal',
      errorCode: 'SECURITY_STAGING_STACK_BOOT_FAILED',
      executable: false,
      actionRunnerAvailable: false
    }));
    process.exitCode = 1;
  });
}

module.exports = {
  SECURITY_STAGING_STACK_VERSION,
  startSecurityStagingStack,
  main
};
