process.env.NODE_ENV = 'production';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SANDBOX_PLAYBOOKS,
  SecurityActionRunnerSandbox
} = require('../security-agent/securityActionRunnerSandbox');

function env() {
  return {
    SECURITY_ACTION_RUNNER_SANDBOX_ENABLED: 'true',
    SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_ACTION_RUNNER_PRODUCTION_WRITE: 'false'
  };
}

function approval(playbookId) {
  const action = SANDBOX_PLAYBOOKS[playbookId].action;
  return Object.freeze({ approvalId: `apr_${playbookId}`, action, state: 'approved', priority: 'P1', executable: false });
}

const targets = Object.freeze({
  P01: 'synthetic:ip-hash:source-a',
  P02: 'synthetic:session:session-a',
  P03: 'synthetic:pipeline:commit-secret-a',
  P04: 'synthetic:deploy:dependency-cve-a'
});

test('Phase 5 sandbox exposes exactly the first four reversible playbooks', () => {
  assert.deepEqual(Object.keys(SANDBOX_PLAYBOOKS), ['P01', 'P02', 'P03', 'P04']);
  for (const [id, spec] of Object.entries(SANDBOX_PLAYBOOKS)) {
    assert.equal(spec.reversible, true, `${id} must be reversible`);
    assert.equal(typeof spec.action, 'string');
    assert.equal(typeof spec.scenario, 'string');
  }
});

test('P01-P04 execute only as synthetic in-memory leases with no external side effect', () => {
  const runner = new SecurityActionRunnerSandbox({ env: env() });
  runner.arm({ authorizationId: 'cp112-first-four-playbooks' });

  const leases = Object.keys(SANDBOX_PLAYBOOKS).map(id => runner.executePlaybook(id, {
    approval: approval(id),
    target: targets[id],
    ttlMs: 120000
  }));

  assert.equal(leases.length, 4);
  assert.equal(runner.status().activeLeaseCount, 4);
  assert.deepEqual(runner.status().supportedPlaybooks, ['P01', 'P02', 'P03', 'P04']);
  for (const lease of leases) {
    assert.equal(lease.syntheticOnly, true);
    assert.equal(lease.reversible, true);
    assert.equal(lease.productionWrite, false);
    assert.equal(lease.externalSideEffect, false);
  }
});

test('P03 secret-in-commit sandbox block is reversible after synthetic remediation', () => {
  const runner = new SecurityActionRunnerSandbox({ env: env() });
  runner.arm({ authorizationId: 'cp112-p03-remediation' });
  const lease = runner.executePlaybook('P03', {
    approval: approval('P03'),
    target: targets.P03,
    ttlMs: 180000
  });
  assert.equal(lease.action, 'sandbox_block_pipeline_secret');
  assert.equal(lease.playbookId, 'P03');
  const rolled = runner.rollback(lease.leaseId, 'synthetic_secret_remediated');
  assert.equal(rolled.rolledBack, true);
  assert.equal(rolled.playbookId, 'P03');
  assert.equal(runner.status().activeLeaseCount, 0);
});

test('P04 critical-CVE sandbox deploy block is reversible by bounded synthetic override', () => {
  const runner = new SecurityActionRunnerSandbox({ env: env() });
  runner.arm({ authorizationId: 'cp112-p04-remediation' });
  const lease = runner.executePlaybook('P04', {
    approval: approval('P04'),
    target: targets.P04,
    ttlMs: 180000
  });
  assert.equal(lease.action, 'sandbox_block_vulnerable_deploy');
  assert.equal(lease.playbookId, 'P04');
  const rolled = runner.rollback(lease.leaseId, 'synthetic_dependency_remediated');
  assert.equal(rolled.rolledBack, true);
  assert.equal(rolled.playbookId, 'P04');
  assert.equal(runner.status().activeLeaseCount, 0);
});

test('kill switch rolls back all four active playbooks and leaves sandbox fail-closed', () => {
  const runner = new SecurityActionRunnerSandbox({ env: env() });
  runner.arm({ authorizationId: 'cp112-first-four-kill-switch' });
  for (const id of Object.keys(SANDBOX_PLAYBOOKS)) {
    runner.executePlaybook(id, { approval: approval(id), target: targets[id], ttlMs: 120000 });
  }
  assert.equal(runner.status().activeLeaseCount, 4);
  const killed = runner.engageKillSwitch('first_four_emergency_stop');
  assert.equal(killed.rolledBack, 4);
  assert.equal(killed.activeLeaseCount, 0);
  assert.equal(killed.productionWrite, false);
  assert.equal(killed.externalSideEffect, false);
  assert.equal(runner.status().executionEnabled, false);
});

test('P03/P04 reject production-like targets and mismatched approvals', () => {
  const runner = new SecurityActionRunnerSandbox({ env: env() });
  runner.arm({ authorizationId: 'cp112-negative-gates' });
  assert.throws(() => runner.executePlaybook('P03', {
    approval: approval('P03'),
    target: 'production:pipeline:main',
    ttlMs: 60000
  }), /SANDBOX_TARGET_NOT_SYNTHETIC/);
  assert.throws(() => runner.executePlaybook('P04', {
    approval: approval('P03'),
    target: targets.P04,
    ttlMs: 60000
  }), /SANDBOX_ACTION_NOT_ALLOWED/);
});
