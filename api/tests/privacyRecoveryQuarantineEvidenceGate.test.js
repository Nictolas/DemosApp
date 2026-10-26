'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessQuarantineEvidence, REQUIRED_CONTROLS } = require('../services/privacyRecoveryQuarantineEvidenceGate');

const now = new Date('2026-10-26T22:00:00.000Z');
const recoveryId = 'synthetic_recovery_20261026';
function complete() {
  const controls = {};
  for (const [key, sourceType] of Object.entries(REQUIRED_CONTROLS)) {
    controls[key] = {
      verified: true, scope: 'production', recoveryId, sourceType,
      observedAt: '2026-10-26T21:59:00.000Z',
      reference: 'synthetic-evidence-0001'
    };
  }
  return { recoveryId, controls };
}
function decision(candidate) { return assessQuarantineEvidence(candidate, { now }); }
test('missing provider evidence never passes offline quarantine preflight', () => {
  const r = decision({ recoveryId, controls: {} });
  assert.equal(r.decision, 'NO_GO');
  assert.equal(r.checked, 0);
  assert.equal(r.blockers.length, Object.keys(REQUIRED_CONTROLS).length);
  assert.ok(r.blockers.some(x => x === 'MISSING:supabaseDataApiDisabled'));
  assert.ok(r.blockers.some(x => x === 'MISSING:renderStagingCredentialsMapped'));
});
test('lack of any one critical channel blocks even an otherwise full package', () => {
  for (const key of Object.keys(REQUIRED_CONTROLS)) {
    const candidate = complete();
    delete candidate.controls[key];
    const r = decision(candidate);
    assert.equal(r.decision, 'NO_GO', key);
    assert.deepEqual(r.blockers, ['MISSING:' + key]);
  }
});
test('misattributed evidence source, non-production scope and unsupported flags are never accepted', () => {
  const a = complete();
  a.controls.supabaseDataApiDisabled.sourceType = 'render_dashboard';
  a.controls.renderWorkersStopped.scope = 'staging';
  a.controls.renderIngressIsolation.verified = 'true';
  a.controls.independentUserClaim = { verified: true };
  const r = decision(a);
  assert.equal(r.decision, 'NO_GO');
  assert.ok(r.blockers.includes('UNKNOWN_CONTROL'));
  assert.ok(r.blockers.includes('UNVERIFIED:supabaseDataApiDisabled'));
  assert.ok(r.blockers.includes('UNVERIFIED:renderWorkersStopped'));
  assert.ok(r.blockers.includes('UNVERIFIED:renderIngressIsolation'));
});
test('stale evidence, future skew and mismatched recovery session fail closed', () => {
  const a = complete();
  a.controls.supabaseDataApiProbe.observedAt = '2026-10-26T21:00:00.000Z';
  a.controls.renderIngressProbe.observedAt = '2026-10-26T22:02:00.000Z';
  a.controls.b2ImmutableVersionReadback.recoveryId = 'other_recovery';
  const r = decision(a);
  assert.equal(r.decision, 'NO_GO');
  assert.ok(r.blockers.includes('STALE_OR_INVALID_TIME:supabaseDataApiProbe'));
  assert.ok(r.blockers.includes('STALE_OR_INVALID_TIME:renderIngressProbe'));
  assert.ok(r.blockers.includes('UNVERIFIED:b2ImmutableVersionReadback'));
});
test('operator evidence cannot include whitespace, query strings or bearer-shaped secrets as references', () => {
  const a = complete();
  a.controls.supabaseDatabaseProbe.reference = 'https://provider.example.com/verify?token=secret';
  const r = decision(a);
  assert.equal(r.decision, 'NO_GO');
  assert.ok(r.blockers.includes('UNVERIFIED:supabaseDatabaseProbe'));
  assert.equal(JSON.stringify(r).includes('token=secret'), false);
});
test('even a synthetically complete set of attestations never produces GO automatically', () => {
  const r = decision(complete());
  assert.equal(r.decision, 'MANUAL_INDEPENDENT_REVIEW_REQUIRED');
  assert.equal(r.checked, r.required);
  assert.deepEqual(r.blockers, []);
  assert.equal(JSON.stringify(r).includes('synthetic-evidence-0001'), false);
  assert.equal(JSON.stringify(r).includes(recoveryId), false);
});
test('invalid input and assessment clocks cannot quietly become approval', () => {
  assert.equal(decision(null).decision, 'NO_GO');
  assert.equal(decision({ recoveryId: 'bad', controls: {} }).decision, 'NO_GO');
  assert.throws(() => assessQuarantineEvidence(complete(), { now: new Date(NaN) }),
    /Invalid offline assessment clock/);
});
