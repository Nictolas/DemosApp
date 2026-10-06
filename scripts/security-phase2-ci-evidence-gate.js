const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/security/phase2-ci-staging-evidence-v0.77.json'), 'utf8').replace(/^\uFEFF/, ''));
const { policyStatus } = require('../api/security-agent/securityPolicyEngine');
const { buildExecutionBoundary } = require('../api/security-agent/securityExecutionBoundary');

assert.equal(manifest.version, '0.77');
assert.equal(manifest.scope, 'ci-ephemeral-staging-evidence');
assert.deepEqual(Object.keys(manifest.tests), ['RT01','RT02','RT03','RT04','RT05','RT06']);
const allowed = new Set(['ci-synthetic-pass', 'ci-pass', 'guardrail-pass']);
for (const [id, item] of Object.entries(manifest.tests)) {
  assert.ok(allowed.has(item.status), `${id}: invalid status`);
  assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0, `${id}: evidence required`);
  assert.ok(Array.isArray(item.externalRemaining), `${id}: externalRemaining required`);
}
assert.equal(manifest.productionTouched, false);
assert.equal(manifest.actionRunnerEnabled, false);
assert.equal(policyStatus().actionRunnerAvailable, false);
assert.equal(policyStatus().executable, false);
const boundary = buildExecutionBoundary({ state:'approved', approvalId:'phase2-gate', action:'propose_session_revocation', priority:'P0' });
assert.equal(boundary.authorized, false);
assert.equal(boundary.executable, false);
assert.equal(boundary.actionRunnerAvailable, false);
console.log('Phase 2 CI/staging evidence gate PASS');
console.log('RT01-RT06 evidence mapped; production untouched; Action Runner disabled.');
