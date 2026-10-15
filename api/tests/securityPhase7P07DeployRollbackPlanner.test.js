const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateActionPolicy } = require('../security-agent/securityPolicyEngine');
const { SecurityL3ApprovalControlPlane } = require('../security-agent/securityL3ApprovalControlPlane');
const {
  P07_ACTION,
  SecurityP07DeployRollbackPlanner
} = require('../security-agent/securityP07DeployRollbackPlanner');

function clock(start = '2026-10-15T18:40:00.000Z') {
  let ms = Date.parse(start);
  return {
    now: () => new Date(ms),
    advance: delta => { ms += delta; }
  };
}

function approvedBoundary({ now, serviceRef = 'render:service:demos-production' } = {}) {
  const plane = new SecurityL3ApprovalControlPlane({ now, boundaryTtlMs: 2 * 60 * 1000 });
  const request = {
    incidentId: 'inc_p07_deploy_anomaly',
    action: P07_ACTION,
    targetRef: serviceRef,
    policyVersion: 'policy-v0.115',
    priority: 'P1'
  };
  const pending = plane.request(request);
  plane.decide(pending.approvalId, 'approved', {
    actorRef: 'admin:security-human',
    source: 'human'
  });
  return {
    plane,
    request,
    boundary: plane.issueDryRunBoundary(pending.approvalId, request)
  };
}

test('P07 traverses catalog policy -> human approval -> L3 boundary -> provider-unbound dry-run plan', () => {
  const c = clock();
  const policy = evaluateActionPolicy(P07_ACTION, { priority: 'P1' });
  assert.equal(policy.decision, 'escalate');
  assert.equal(policy.executable, false);

  const serviceRef = 'render:service:demos-production';
  const { boundary } = approvedBoundary({ now: c.now, serviceRef });
  const planner = new SecurityP07DeployRollbackPlanner({ now: c.now });
  const plan = planner.plan({
    boundary,
    serviceRef,
    currentDeployRef: 'render:deploy:dep_current_bad',
    healthyDeployRef: 'render:deploy:dep_known_good'
  });

  assert.equal(plan.playbookId, 'P07');
  assert.equal(plan.action, P07_ACTION);
  assert.equal(plan.operation, 'rollback_deploy');
  assert.equal(plan.provider, 'unbound');
  assert.equal(plan.approvalBound, true);
  assert.equal(plan.singleUseBoundary, true);
  assert.equal(plan.humanApprovalRequired, true);
  assert.equal(plan.dryRunOnly, true);
  assert.equal(plan.externalWrite, false);
  assert.equal(plan.providerAdapterAvailable, false);
  assert.equal(plan.authorized, false);
  assert.equal(plan.executable, false);
  assert.equal(plan.actionRunnerAvailable, false);
  assert.match(plan.serviceHash, /^[a-f0-9]{64}$/);
  assert.match(plan.currentDeployHash, /^[a-f0-9]{64}$/);
  assert.match(plan.healthyDeployHash, /^[a-f0-9]{64}$/);
});

test('P07 rejects wrong action, malformed boundary and service-binding mismatch', () => {
  const c = clock();
  const serviceRef = 'render:service:demos-production';
  const { boundary } = approvedBoundary({ now: c.now, serviceRef });

  assert.throws(() => new SecurityP07DeployRollbackPlanner({ now: c.now }).plan({
    boundary: { ...boundary, action: 'propose_secret_rotation' },
    serviceRef,
    currentDeployRef: 'dep_bad',
    healthyDeployRef: 'dep_good'
  }), /P07_BOUNDARY_ACTION_MISMATCH/);

  assert.throws(() => new SecurityP07DeployRollbackPlanner({ now: c.now }).plan({
    boundary: { ...boundary, approvalBound: false },
    serviceRef,
    currentDeployRef: 'dep_bad',
    healthyDeployRef: 'dep_good'
  }), /P07_BOUNDARY_NOT_APPROVAL_BOUND/);

  assert.throws(() => new SecurityP07DeployRollbackPlanner({ now: c.now }).plan({
    boundary,
    serviceRef: 'render:service:other',
    currentDeployRef: 'dep_bad',
    healthyDeployRef: 'dep_good'
  }), /P07_SERVICE_BINDING_MISMATCH/);
});

test('P07 rejects expired boundary and any boundary that claims execution capability', () => {
  const c = clock();
  const serviceRef = 'render:service:demos-production';
  const { boundary } = approvedBoundary({ now: c.now, serviceRef });
  c.advance(2 * 60 * 1000 + 1);

  assert.throws(() => new SecurityP07DeployRollbackPlanner({ now: c.now }).plan({
    boundary,
    serviceRef,
    currentDeployRef: 'dep_bad',
    healthyDeployRef: 'dep_good'
  }), /P07_BOUNDARY_EXPIRED/);

  const c2 = clock();
  const valid = approvedBoundary({ now: c2.now, serviceRef }).boundary;
  assert.throws(() => new SecurityP07DeployRollbackPlanner({ now: c2.now }).plan({
    boundary: { ...valid, authorized: true },
    serviceRef,
    currentDeployRef: 'dep_bad',
    healthyDeployRef: 'dep_good'
  }), /P07_EXECUTION_CAPABILITY_FORBIDDEN/);
});

test('P07 rejects no-op rollback and boundary replay', () => {
  const c = clock();
  const serviceRef = 'render:service:demos-production';
  const { boundary } = approvedBoundary({ now: c.now, serviceRef });
  const planner = new SecurityP07DeployRollbackPlanner({ now: c.now });

  assert.throws(() => planner.plan({
    boundary,
    serviceRef,
    currentDeployRef: 'dep_same',
    healthyDeployRef: 'dep_same'
  }), /P07_DEPLOY_TARGET_UNCHANGED/);

  planner.plan({
    boundary,
    serviceRef,
    currentDeployRef: 'dep_bad',
    healthyDeployRef: 'dep_good'
  });
  assert.throws(() => planner.plan({
    boundary,
    serviceRef,
    currentDeployRef: 'dep_bad_2',
    healthyDeployRef: 'dep_good_2'
  }), /P07_BOUNDARY_REPLAY/);
});

test('P07 kill switch is one-way for the planner instance and blocks new plans', () => {
  const c = clock();
  const serviceRef = 'render:service:demos-production';
  const { boundary } = approvedBoundary({ now: c.now, serviceRef });
  const planner = new SecurityP07DeployRollbackPlanner({ now: c.now });
  const status = planner.engageKillSwitch('P07_EMERGENCY_STOP');
  assert.equal(status.killSwitchEngaged, true);
  assert.equal(status.authorized, false);
  assert.equal(status.executable, false);
  assert.throws(() => planner.plan({
    boundary,
    serviceRef,
    currentDeployRef: 'dep_bad',
    healthyDeployRef: 'dep_good'
  }), /P07_KILL_SWITCH_ENGAGED/);
});

test('P07 output and audit contain hashes only, never raw service/deploy refs or tokens', () => {
  const c = clock();
  const serviceRef = 'https://api.render.example/services/srv-prod?token=supersecret';
  const currentDeployRef = 'deploy://current?credential=current-secret';
  const healthyDeployRef = 'deploy://healthy?credential=healthy-secret';
  const { boundary } = approvedBoundary({ now: c.now, serviceRef });
  const planner = new SecurityP07DeployRollbackPlanner({ now: c.now });
  const plan = planner.plan({ boundary, serviceRef, currentDeployRef, healthyDeployRef });
  const serialized = JSON.stringify({ plan, audit: planner.listAudit({ limit: 20 }) });

  for (const forbidden of [
    serviceRef,
    currentDeployRef,
    healthyDeployRef,
    'supersecret',
    'current-secret',
    'healthy-secret'
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.match(serialized, /serviceHash/);
  assert.match(serialized, /currentDeployHash/);
  assert.match(serialized, /healthyDeployHash/);
  for (const event of planner.listAudit({ limit: 20 })) {
    assert.equal(event.provider, 'unbound');
    assert.equal(event.dryRunOnly, true);
    assert.equal(event.externalWrite, false);
    assert.equal(event.authorized, false);
    assert.equal(event.executable, false);
    assert.equal(event.actionRunnerAvailable, false);
  }
});
