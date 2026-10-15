// CP-110 validated on isolated Render staging: kill switch + TTL rollback, production writes forbidden.
process.env.NODE_ENV = 'production';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildActionRunnerSandboxConfig,
  SecurityActionRunnerSandbox
} = require('../security-agent/securityActionRunnerSandbox');

function safeEnv(overrides = {}) {
  return {
    SECURITY_ACTION_RUNNER_SANDBOX_ENABLED: 'true',
    SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_ACTION_RUNNER_PRODUCTION_WRITE: 'false',
    ...overrides
  };
}

function approved(action, id = 'apr_sandbox_1') {
  return Object.freeze({ approvalId: id, action, state: 'approved', priority: 'P1', executable: false });
}

test('Action Runner sandbox is fail-closed and cannot be configured for production writes', () => {
  const disabled = buildActionRunnerSandboxConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.ready, false);
  assert.equal(disabled.productionWriteAllowed, false);

  const prod = buildActionRunnerSandboxConfig(safeEnv({ SECURITY_AGENT_ENVIRONMENT_CLASS: 'production' }));
  assert.equal(prod.ready, false);
  assert.ok(prod.blockers.includes('environment_class_not_staging'));

  const prodWrite = buildActionRunnerSandboxConfig(safeEnv({ SECURITY_ACTION_RUNNER_PRODUCTION_WRITE: 'true' }));
  assert.equal(prodWrite.ready, false);
  assert.ok(prodWrite.blockers.includes('production_write_forbidden'));
});

test('sandbox starts with kill switch engaged and requires explicit sandbox authorization', () => {
  const runner = new SecurityActionRunnerSandbox({ env: safeEnv() });
  const status = runner.status();
  assert.equal(status.actionRunnerAvailable, true);
  assert.equal(status.executionEnabled, false);
  assert.equal(status.killSwitchEngaged, true);
  assert.equal(status.productionWriteAllowed, false);
  assert.throws(() => runner.execute({
    approval: approved('propose_rate_limit'),
    action: 'propose_rate_limit',
    target: 'synthetic:ip:1',
    ttlMs: 60000
  }), /SANDBOX_KILL_SWITCH_ENGAGED/);
});

test('sandbox accepts only approved allowlisted actions against synthetic targets', () => {
  const runner = new SecurityActionRunnerSandbox({ env: safeEnv() });
  runner.arm({ authorizationId: 'rt10-explicit-sandbox-authorization' });

  assert.throws(() => runner.execute({
    approval: { ...approved('propose_rate_limit'), state: 'pending' },
    action: 'propose_rate_limit', target: 'synthetic:ip:1', ttlMs: 60000
  }), /SANDBOX_APPROVAL_REQUIRED/);

  assert.throws(() => runner.execute({
    approval: approved('propose_endpoint_isolation'),
    action: 'propose_endpoint_isolation', target: 'synthetic:endpoint:1', ttlMs: 60000
  }), /SANDBOX_ACTION_NOT_ALLOWED/);

  assert.throws(() => runner.execute({
    approval: approved('propose_rate_limit'),
    action: 'propose_rate_limit', target: 'production:ip:1', ttlMs: 60000
  }), /SANDBOX_TARGET_NOT_SYNTHETIC/);
});

test('P01-like synthetic rate-limit lease expires and rolls back by TTL', () => {
  let now = new Date('2026-10-15T18:00:00.000Z');
  const runner = new SecurityActionRunnerSandbox({ env: safeEnv(), now: () => now });
  runner.arm({ authorizationId: 'cp110-p01-sandbox' });
  const lease = runner.execute({
    approval: approved('propose_rate_limit', 'apr_p01'),
    action: 'propose_rate_limit',
    target: 'synthetic:ip-hash:test-source',
    ttlMs: 60000
  });
  assert.equal(lease.reversible, true);
  assert.equal(lease.productionWrite, false);
  assert.equal(runner.status().activeLeaseCount, 1);

  now = new Date('2026-10-15T18:01:01.000Z');
  const sweep = runner.sweepExpired();
  assert.equal(sweep.rolledBack, 1);
  assert.equal(sweep.activeLeaseCount, 0);
  assert.equal(runner.listAudit().some(item => item.type === 'rolled_back' && item.reason === 'ttl_expired'), true);
});

test('P02-like synthetic session revocation supports explicit rollback', () => {
  const runner = new SecurityActionRunnerSandbox({ env: safeEnv() });
  runner.arm({ authorizationId: 'cp110-p02-sandbox' });
  const lease = runner.execute({
    approval: approved('propose_session_revocation', 'apr_p02'),
    action: 'propose_session_revocation',
    target: 'synthetic:session:abc123',
    ttlMs: 120000
  });
  const rollback = runner.rollback(lease.leaseId, 'manual_recovery');
  assert.equal(rollback.rolledBack, true);
  assert.equal(rollback.productionWrite, false);
  assert.equal(runner.status().activeLeaseCount, 0);
});

test('RT10 kill switch rolls back every active synthetic action and blocks further execution', () => {
  const runner = new SecurityActionRunnerSandbox({ env: safeEnv() });
  runner.arm({ authorizationId: 'rt10-kill-switch-drill' });
  runner.execute({
    approval: approved('propose_rate_limit', 'apr_rt10_1'),
    action: 'propose_rate_limit', target: 'synthetic:ip-hash:a', ttlMs: 120000
  });
  runner.execute({
    approval: approved('propose_session_revocation', 'apr_rt10_2'),
    action: 'propose_session_revocation', target: 'synthetic:session:b', ttlMs: 120000
  });
  assert.equal(runner.status().activeLeaseCount, 2);

  const killed = runner.engageKillSwitch('rt10_emergency_stop');
  assert.equal(killed.killSwitchEngaged, true);
  assert.equal(killed.rolledBack, 2);
  assert.equal(killed.activeLeaseCount, 0);
  assert.equal(runner.status().executionEnabled, false);
  assert.equal(runner.status().productionWriteAllowed, false);

  assert.throws(() => runner.execute({
    approval: approved('propose_rate_limit', 'apr_rt10_3'),
    action: 'propose_rate_limit', target: 'synthetic:ip-hash:c', ttlMs: 120000
  }), /SANDBOX_KILL_SWITCH_ENGAGED/);

  const audit = runner.listAudit();
  assert.equal(audit.some(item => item.type === 'kill_switch_engaged'), true);
  assert.equal(audit.filter(item => item.type === 'rolled_back' && item.reason === 'kill_switch').length, 2);
});
