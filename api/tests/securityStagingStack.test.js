const test = require('node:test');
const assert = require('node:assert/strict');
const { startSecurityStagingStack } = require('../security-agent/securityStagingStack');

function env(overrides = {}) {
  return {
    SECURITY_AGENT_PROCESS_ENABLED: 'false',
    ...overrides
  };
}

function fakeServer() {
  return {
    closed: false,
    close(callback) {
      this.closed = true;
      if (callback) callback();
    }
  };
}

test('staging stack keeps worker off when process flag is disabled', async () => {
  let workerCalls = 0;
  const server = fakeServer();
  const stack = await startSecurityStagingStack({
    env: env(),
    workerStarter: async () => { workerCalls += 1; return null; },
    serverStarter: ({ service }) => {
      assert.ok(service);
      return server;
    },
    serviceFactory: ({ runtime, runner, store }) => {
      assert.equal(runtime, null);
      assert.equal(runner, null);
      assert.equal(store, null);
      return { mode: 'read-only' };
    }
  });
  assert.equal(workerCalls, 0);
  assert.equal(stack.workerStarted, false);
  assert.equal(stack.executable, false);
  assert.equal(stack.actionRunnerAvailable, false);
  await stack.shutdown('test');
  assert.equal(server.closed, true);
});

test('staging stack binds Security Center to the actual read-only runtime when worker is enabled', async () => {
  const store = { id: 'memory-store' };
  const runner = { store, status() { return { enabled:true }; } };
  const runtime = { runner, status() { return { state:'running' }; } };
  let shutdownSignal = null;
  const worker = { started:true, runtime, async shutdown(signal) { shutdownSignal = signal; } };
  const server = fakeServer();
  let serviceArgs = null;

  const stack = await startSecurityStagingStack({
    env: env({ SECURITY_AGENT_PROCESS_ENABLED:'true' }),
    workerStarter: async () => worker,
    serviceFactory: args => { serviceArgs = args; return { linked:true }; },
    serverStarter: ({ service }) => {
      assert.deepEqual(service, { linked:true });
      return server;
    },
    logger: { log() {} }
  });

  assert.equal(stack.workerStarted, true);
  assert.equal(serviceArgs.runtime, runtime);
  assert.equal(serviceArgs.runner, runner);
  assert.equal(serviceArgs.store, store);
  await stack.shutdown('SIGTERM');
  assert.equal(server.closed, true);
  assert.equal(shutdownSignal, 'SIGTERM');
});

test('stack fails closed when an explicitly enabled worker cannot start', async () => {
  let shutdownCalls = 0;
  await assert.rejects(
    () => startSecurityStagingStack({
      env: env({ SECURITY_AGENT_PROCESS_ENABLED:'true' }),
      workerStarter: async () => ({ started:false, runtime:null, async shutdown() { shutdownCalls += 1; } }),
      serverStarter: () => { throw new Error('server must not start'); },
      serviceFactory: () => ({})
    }),
    error => error?.code === 'SECURITY_STAGING_WORKER_NOT_STARTED'
  );
  assert.equal(shutdownCalls, 1);
});

test('server startup failure shuts down an already started worker', async () => {
  let shutdownSignal = null;
  const runtime = { runner:{ store:{}, status(){ return {}; } }, status(){ return {}; } };
  await assert.rejects(
    () => startSecurityStagingStack({
      env: env({ SECURITY_AGENT_PROCESS_ENABLED:'true' }),
      workerStarter: async () => ({ started:true, runtime, async shutdown(signal){ shutdownSignal = signal; } }),
      serviceFactory: () => ({}),
      serverStarter: () => { throw new Error('bind failed'); }
    }),
    /bind failed/
  );
  assert.equal(shutdownSignal, 'STARTUP_FAILED');
});
