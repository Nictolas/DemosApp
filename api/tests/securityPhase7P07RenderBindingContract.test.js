const test = require('node:test');
const assert = require('node:assert/strict');
const { SecurityL3ApprovalControlPlane } = require('../security-agent/securityL3ApprovalControlPlane');
const { SecurityP07DeployRollbackPlanner } = require('../security-agent/securityP07DeployRollbackPlanner');
const { SecurityP07RenderBindingContract } = require('../security-agent/securityP07RenderBindingContract');

function clock(start = '2026-10-15T19:10:00.000Z') {
  let ms = Date.parse(start);
  return { now: () => new Date(ms), advance: delta => { ms += delta; } };
}

function validFixture(now) {
  const serviceRef = 'render:service:demos-production';
  const currentDeployRef = 'render:deploy:dep_current_bad';
  const healthyDeployRef = 'render:deploy:dep_known_good';
  const plane = new SecurityL3ApprovalControlPlane({ now });
  const request = {
    incidentId: 'inc_p07_render_binding',
    action: 'propose_deploy_rollback',
    targetRef: serviceRef,
    policyVersion: 'policy-v0.116',
    priority: 'P1'
  };
  const pending = plane.request(request);
  plane.decide(pending.approvalId, 'approved', { actorRef: 'admin:security-human', source: 'human' });
  const boundary = plane.issueDryRunBoundary(pending.approvalId, request);
  const planner = new SecurityP07DeployRollbackPlanner({ now });
  const plan = planner.plan({ boundary, serviceRef, currentDeployRef, healthyDeployRef });
  return { serviceRef, currentDeployRef, healthyDeployRef, plan };
}

test('valid P07 plan binds to an offline Render descriptor and remains non-executable', () => {
  const c = clock();
  const fixture = validFixture(c.now);
  const contract = new SecurityP07RenderBindingContract({ now: c.now });
  const descriptor = contract.bind(fixture);

  assert.equal(descriptor.provider, 'render');
  assert.equal(descriptor.providerBindingMode, 'offline_descriptor');
  assert.equal(descriptor.playbookId, 'P07');
  assert.equal(descriptor.approvalBound, true);
  assert.equal(descriptor.singleUseBinding, true);
  assert.equal(descriptor.humanApprovalRequired, true);
  assert.equal(descriptor.dryRunOnly, true);
  assert.equal(descriptor.networkEnabled, false);
  assert.equal(descriptor.transportEnabled, false);
  assert.equal(descriptor.externalWrite, false);
  assert.equal(descriptor.credentialFieldsAccepted, false);
  assert.equal(descriptor.providerClientAvailable, false);
  assert.equal(descriptor.authorized, false);
  assert.equal(descriptor.executable, false);
  assert.equal(descriptor.actionRunnerAvailable, false);
});

test('service/current/healthy deploy hash mismatches fail closed', () => {
  const c = clock();
  const fixture = validFixture(c.now);

  assert.throws(() => new SecurityP07RenderBindingContract({ now: c.now }).bind({
    ...fixture,
    serviceRef: 'render:service:other'
  }), /P07_RENDER_SERVICE_HASH_MISMATCH/);
  assert.throws(() => new SecurityP07RenderBindingContract({ now: c.now }).bind({
    ...fixture,
    currentDeployRef: 'render:deploy:other-current'
  }), /P07_RENDER_CURRENT_DEPLOY_HASH_MISMATCH/);
  assert.throws(() => new SecurityP07RenderBindingContract({ now: c.now }).bind({
    ...fixture,
    healthyDeployRef: 'render:deploy:other-healthy'
  }), /P07_RENDER_HEALTHY_DEPLOY_HASH_MISMATCH/);
});

test('altered or non approval-bound P07 plan is denied', () => {
  const c = clock();
  const fixture = validFixture(c.now);

  assert.throws(() => new SecurityP07RenderBindingContract({ now: c.now }).bind({
    ...fixture,
    plan: { ...fixture.plan, action: 'propose_secret_rotation' }
  }), /P07_RENDER_PLAN_ACTION_INVALID/);
  assert.throws(() => new SecurityP07RenderBindingContract({ now: c.now }).bind({
    ...fixture,
    plan: { ...fixture.plan, provider: 'render' }
  }), /P07_RENDER_PLAN_PROVIDER_STATE_INVALID/);
  assert.throws(() => new SecurityP07RenderBindingContract({ now: c.now }).bind({
    ...fixture,
    plan: { ...fixture.plan, approvalBound: false }
  }), /P07_RENDER_PLAN_NOT_APPROVAL_BOUND/);
  assert.throws(() => new SecurityP07RenderBindingContract({ now: c.now }).bind({
    ...fixture,
    plan: { ...fixture.plan, externalWrite: true }
  }), /P07_RENDER_PLAN_EXECUTION_CAPABILITY_FORBIDDEN/);
});

test('credential, client and network configuration fields are rejected recursively', () => {
  const c = clock();
  const fixture = validFixture(c.now);
  const forbiddenPayloads = [
    { ...fixture, token: 'nope' },
    { ...fixture, credential: 'nope' },
    { ...fixture, client: {} },
    { ...fixture, fetch: 'nope' },
    { ...fixture, baseUrl: 'https://api.render.com' },
    { ...fixture, headers: { Authorization: 'Bearer nope' } },
    { ...fixture, config: { apiKey: 'nope' } },
    { ...fixture, config: { secret: 'nope' } }
  ];
  for (const payload of forbiddenPayloads) {
    assert.throws(
      () => new SecurityP07RenderBindingContract({ now: c.now }).bind(payload),
      /P07_RENDER_FORBIDDEN_FIELD/
    );
  }
});

test('Render binding is single-use and rejects replay', () => {
  const c = clock();
  const fixture = validFixture(c.now);
  const contract = new SecurityP07RenderBindingContract({ now: c.now });
  contract.bind(fixture);
  assert.throws(() => contract.bind(fixture), /P07_RENDER_BINDING_REPLAY/);
});

test('Render binding kill switch blocks all new descriptor creation', () => {
  const c = clock();
  const fixture = validFixture(c.now);
  const contract = new SecurityP07RenderBindingContract({ now: c.now });
  const status = contract.engageKillSwitch('P07_RENDER_STOP');
  assert.equal(status.killSwitchEngaged, true);
  assert.equal(status.networkEnabled, false);
  assert.equal(status.externalWrite, false);
  assert.throws(() => contract.bind(fixture), /P07_RENDER_KILL_SWITCH_ENGAGED/);
});

test('descriptor and audit never expose raw provider refs, URLs, token-like values or secrets', () => {
  const c = clock();
  const serviceRef = 'https://api.render.example/services/srv-prod?x=supersecret';
  const currentDeployRef = 'render://deploy/current?x=current-secret';
  const healthyDeployRef = 'render://deploy/healthy?x=healthy-secret';
  const plane = new SecurityL3ApprovalControlPlane({ now: c.now });
  const request = {
    incidentId: 'inc_redaction',
    action: 'propose_deploy_rollback',
    targetRef: serviceRef,
    policyVersion: 'policy-v0.116',
    priority: 'P1'
  };
  const pending = plane.request(request);
  plane.decide(pending.approvalId, 'approved', { actorRef: 'human@example.com', source: 'human' });
  const boundary = plane.issueDryRunBoundary(pending.approvalId, request);
  const plan = new SecurityP07DeployRollbackPlanner({ now: c.now }).plan({
    boundary,
    serviceRef,
    currentDeployRef,
    healthyDeployRef
  });
  const contract = new SecurityP07RenderBindingContract({ now: c.now });
  const descriptor = contract.bind({ plan, serviceRef, currentDeployRef, healthyDeployRef });
  const serialized = JSON.stringify({ descriptor, audit: contract.listAudit({ limit: 20 }) });

  for (const forbidden of [
    serviceRef,
    currentDeployRef,
    healthyDeployRef,
    'supersecret',
    'current-secret',
    'healthy-secret',
    'human@example.com'
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);

  for (const event of contract.listAudit({ limit: 20 })) {
    assert.equal(event.provider, 'render');
    assert.equal(event.networkEnabled, false);
    assert.equal(event.transportEnabled, false);
    assert.equal(event.externalWrite, false);
    assert.equal(event.authorized, false);
    assert.equal(event.executable, false);
    assert.equal(event.actionRunnerAvailable, false);
  }
});
