const test = require('node:test');
const assert = require('node:assert/strict');
const { SecurityL3ApprovalControlPlane } = require('../security-agent/securityL3ApprovalControlPlane');

function controlledClock(start = '2026-10-15T18:20:00Z') {
  let ms = Date.parse(start);
  return {
    now: () => new Date(ms),
    advance: delta => { ms += delta; }
  };
}

function baseRequest(overrides = {}) {
  return {
    incidentId: 'inc_114_demo',
    action: 'propose_endpoint_isolation',
    targetRef: 'synthetic:edge:route-42',
    policyVersion: 'policy-v0.114',
    priority: 'P2',
    ...overrides
  };
}

function approveHuman(plane, request = baseRequest()) {
  const pending = plane.request(request);
  const approved = plane.decide(pending.approvalId, 'approved', {
    actorRef: 'admin:qa-human',
    source: 'human'
  });
  return { pending, approved, request };
}

test('Phase 7 pre-gate remains shadow, dry-run only and non-executable', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now });
  const status = plane.status();
  assert.equal(status.mode, 'shadow_pre_gate');
  assert.equal(status.humanApprovalRequired, true);
  assert.equal(status.approvalBound, true);
  assert.equal(status.singleUse, true);
  assert.equal(status.dryRunOnly, true);
  assert.equal(status.authorized, false);
  assert.equal(status.executable, false);
  assert.equal(status.actionRunnerAvailable, false);
  assert.equal(status.productionAdaptersAvailable, false);
  assert.equal(status.approvalGate.executionEnabled, false);
  assert.equal(status.approvalGate.simulationOnly, true);
});

test('exact human-approved binding yields only a single-use dry-run boundary', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now });
  const { pending, request } = approveHuman(plane);
  const boundary = plane.issueDryRunBoundary(pending.approvalId, request);
  assert.equal(boundary.approvalBound, true);
  assert.equal(boundary.singleUse, true);
  assert.equal(boundary.dryRunOnly, true);
  assert.equal(boundary.authorized, false);
  assert.equal(boundary.executable, false);
  assert.equal(boundary.actionRunnerAvailable, false);
  assert.equal(boundary.incidentId, request.incidentId);
  assert.match(boundary.targetHash, /^[a-f0-9]{64}$/);
  assert.match(boundary.bindingHash, /^[a-f0-9]{64}$/);
  assert.throws(
    () => plane.issueDryRunBoundary(pending.approvalId, request),
    /L3_APPROVAL_REPLAY/
  );
});

test('wrong incident, action, target or policy snapshot fails closed without consuming approval', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now });
  const { pending, request } = approveHuman(plane);
  const mismatches = [
    { ...request, incidentId: 'inc_other' },
    { ...request, action: 'propose_secret_rotation' },
    { ...request, targetRef: 'synthetic:edge:route-99' },
    { ...request, policyVersion: 'policy-v0.115' }
  ];
  for (const mismatch of mismatches) {
    assert.throws(
      () => plane.issueDryRunBoundary(pending.approvalId, mismatch),
      /L3_BINDING_MISMATCH/
    );
  }
  const boundary = plane.issueDryRunBoundary(pending.approvalId, request);
  assert.equal(boundary.dryRunOnly, true);
  assert.equal(boundary.executable, false);
});

test('expired approval cannot produce a boundary', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now, ttlMs: 2 * 60 * 1000 });
  const { pending, request } = approveHuman(plane);
  clock.advance(2 * 60 * 1000 + 1);
  assert.throws(
    () => plane.issueDryRunBoundary(pending.approvalId, request),
    /L3_APPROVAL_EXPIRED/
  );
});

test('kill switch blocks approved boundaries and new approval requests', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now });
  const { pending, request } = approveHuman(plane);
  const status = plane.engageKillSwitch('CP114_TEST');
  assert.equal(status.killSwitchEngaged, true);
  assert.equal(status.executable, false);
  assert.throws(
    () => plane.issueDryRunBoundary(pending.approvalId, request),
    /L3_KILL_SWITCH_ENGAGED/
  );
  assert.throws(
    () => plane.request(baseRequest({ incidentId: 'inc_after_kill' })),
    /L3_KILL_SWITCH_ENGAGED/
  );
});

test('AI or unspecified decision source cannot approve an L3 request', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now });
  const pending = plane.request(baseRequest());
  assert.throws(
    () => plane.decide(pending.approvalId, 'approved', { actorRef: 'security-ai', source: 'ai' }),
    /L3_HUMAN_DECISION_REQUIRED/
  );
  assert.throws(
    () => plane.decide(pending.approvalId, 'approved', { actorRef: 'admin:qa-human' }),
    /L3_HUMAN_DECISION_REQUIRED/
  );
  const approved = plane.decide(pending.approvalId, 'approved', {
    actorRef: 'admin:qa-human',
    source: 'human'
  });
  assert.equal(approved.state, 'approved');
  assert.equal(approved.executable, false);
});

test('rejected and malformed approvals fail closed', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now });
  assert.throws(
    () => plane.request(baseRequest({ targetRef: '' })),
    /L3_TARGET_REF_REQUIRED/
  );
  assert.throws(
    () => plane.request(baseRequest({ action: 'delete_everything' })),
    /APPROVAL_ACTION_NOT_ALLOWED/
  );
  const request = baseRequest();
  const pending = plane.request(request);
  plane.decide(pending.approvalId, 'rejected', {
    actorRef: 'admin:qa-human',
    source: 'human'
  });
  assert.throws(
    () => plane.issueDryRunBoundary(pending.approvalId, request),
    /L3_APPROVAL_NOT_APPROVED/
  );
});

test('audit stores hashes instead of raw target or human actor reference', () => {
  const clock = controlledClock();
  const plane = new SecurityL3ApprovalControlPlane({ now: clock.now });
  const targetRef = 'prod-like://db/customer@example.com?token=supersecret';
  const actorRef = 'human-admin@example.com';
  const request = baseRequest({ targetRef });
  const pending = plane.request(request);
  plane.decide(pending.approvalId, 'approved', { actorRef, source: 'human' });
  plane.issueDryRunBoundary(pending.approvalId, request);
  const serialized = JSON.stringify(plane.listAudit({ limit: 20 }));
  assert.equal(serialized.includes(targetRef), false);
  assert.equal(serialized.includes(actorRef), false);
  assert.equal(serialized.includes('supersecret'), false);
  assert.match(serialized, /targetHash/);
  assert.match(serialized, /actorHash/);
  for (const event of plane.listAudit({ limit: 20 })) {
    assert.equal(event.authorized, false);
    assert.equal(event.executable, false);
    assert.equal(event.actionRunnerAvailable, false);
    assert.equal(event.dryRunOnly, true);
  }
});
