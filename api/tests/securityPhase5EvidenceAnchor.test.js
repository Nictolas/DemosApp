process.env.NODE_ENV = 'production';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACTION_RUNNER_SANDBOX_VERSION,
  SANDBOX_PLAYBOOKS
} = require('../security-agent/securityActionRunnerSandbox');

test('CP-112 evidence matches the qualified first-four-playbook sandbox contract', () => {
  assert.equal(ACTION_RUNNER_SANDBOX_VERSION, 'v0.112');
  assert.deepEqual(Object.keys(SANDBOX_PLAYBOOKS), ['P01', 'P02', 'P03', 'P04']);
  for (const spec of Object.values(SANDBOX_PLAYBOOKS)) assert.equal(spec.reversible, true);
});
