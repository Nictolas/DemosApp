const test = require('node:test');
const assert = require('node:assert/strict');
const { SecurityL3ApprovalControlPlane } = require('../security-agent/securityL3ApprovalControlPlane');
const { SecurityP07DeployRollbackPlanner } = require('../security-agent/securityP07DeployRollbackPlanner');
const { SecurityP07RenderDryRunContract } = require('../security-agent/securityP07RenderDryRunContract');

function clock(start = '2026-10-15T19:05:00.000Z') {
  let ms = Date.parse(start);
  return {
    now: () => new Date(ms),
    advance: delta => { ms += delta; }
  };
}

function buildPlan({ now, serviceRef, currentDeployRef, healthyDeployRef } = {}) {
  const service = serviceRef || 'render:service:demos-production';
  const current = currentDeployRef || 'render:deploy:dep_current_bad';
  const healthy = healthyDeployRef || 'render:deploy:dep_known_good';
  const plane = new SecurityL3ApprovalControlPlane({ now, boundaryTtlMs: 2 * 60 * 1000 });
  const request = {
    incidentId: 'inc_p07_render_binding',
    action: 'propose_deploy_rollback',
    targetRef: service,
    policyVersion: 'policy-v0.116',
    priority: 'P1'
  };
  const pending = plane.request(request);
  plane.decide(pending.approvalId, 'approved', {
    actorRef: 'admin:security-human',
    source: 'human'
  });
  const boundary = plane.issueDryRunBoundary(pending.approvalId, request);
  const planner = new SecurityP07DeployRollbackPlanner({ now });
  const plan = planner.plan({
    boundary,
    serviceRef: service,
    currentDeployRef: current,
    healthyDeployRef: healthy
  });
  return { plan, service, current, healthy };
}

test('P07 Render contract re-binds a valid provider-unbound plan without enabling network or execution', () => {
  const c = clock();
  const fixture = buildPlan({ now: c.now });
  const contract = new SecurityP07RenderDryRunContract({ now: c.now });
  const descriptor = contract.bind({
    plan: fixture.plan,
    binding: {
      serviceRef: fixture.service,
      currentDeployRef: fixture.current,
      healthyDeployRef: fixture.healthy
    }
  });

  assert.equal(descriptor.playbookId, 'P07');
  assert.equal(descriptor.action, 'propose_deploy_rollback');
  assert.equal(descriptor.provider, 'render');
  assert.equal(descriptor.adapterMode, 'contract_only');
  assert.equal(descriptor.approvalBound, true);
  assert.equal(descriptor.singleUseBinding, true);
  assert.equal(descriptor.dryRunOnly, true);
  assert.equal(descriptor.networkEnabled, false);
  assert.equal(descriptor.credentialMode, 'none');
  assert.equal(descriptor.providerClientAvailable, false);
  assert.equal(descriptor.requestMaterialized, false);
  assert.equal(descriptor.externalWrite, false);
  assert.equal(descriptor.authorized, false);
  assert.equal(descriptor.executable, false);
  assert.equal(descriptor.actionRunnerAvailable, false);
});

test('P07 Render contract rejects service/current/healthy hash mismatches', () => {
  const c = clock();
  const fixture = buildPlan({ now: c.now });

  assert.throws(() => new SecurityP07RenderDryRunContract({ now: c.now }).bind({
    plan: fixture.plan,
    binding: { serviceRef: 'render:service:other', currentDeployRef: fixture.current, healthyDeployRef: fixture.healthy }
  }), /P07_RENDER_SERVICE_BINDING_MISMATCH/);

  assert.throws(() => new SecurityP07RenderDryRunContract({ now: c.now }).bind({
    plan: fixture.plan,
    binding: { serviceRef: fixture.service, currentDeployRef: 'render:deploy:other', healthyDeployRef: fixture.healthy }
  }), /P07_RENDER_CURRENT_DEPLOY_BINDING_MISMATCH/);

  assert.throws(() => new SecurityP07RenderDryRunContract({ now: c.now }).bind({
    plan: fixture.plan,
    binding: { serviceRef: fixture.service, currentDeployRef: fixture.current, healthyDeployRef: 'render:deploy:other' }
  }), /P07_RENDER_HEALTHY_DEPLOY_BINDING_MISMATCH/);
});

test('P07 Render contract rejects altered plans and execution-capable flags', () => {
  const c = clock();
  const fixture = buildPlan({ now: c.now });
  const validBinding = {
    serviceRef: fixture.service,
    currentDeployRef: fixture.current,
    healthyDeployRef: fixture.healthy
  };

  assert.throws(() => new SecurityP07RenderDryRunContract({ now: c.now }).bind({
    plan: { ...fixture.plan, provider: 'render' },
    binding: validBinding
  }), /P07_RENDER_PLAN_PROVIDER_INVALID/);

  assert.throws(() => new SecurityP07RenderDryRunContract({ now: c.now }).bind({
    plan: { ...fixture.plan, approvalBound: false },
    binding: validBinding
  }), /P07_RENDER_PLAN_APPROVAL_INVALID/);

  assert.throws(() => new SecurityP07RenderDryRunContract({ now: c.now }).bind({
    plan: { ...fixture.plan, authorized: true },
    binding: validBinding
  }), /P07_RENDER_EXECUTION_CAPABILITY_FORBIDDEN/);
});

test('P07 Render contract rejects credentials, clients and network configuration by allowing only binding refs', () => {
  const c = clock();
  const fixture = buildPlan({ now: c.now });
  for (const [key, value] of [
    ['token', 'secret-token'],
    ['apiKey', 'secret-key'],
    ['client', {}],
    ['fetch', () => {}],
    ['baseUrl', 'https://api.render.com'],
    ['headers', { Authorization: 'Bearer secret' }],
    ['credential', 'secret']
  ]) {
    assert.throws(() => new SecurityP07RenderDryRunContract({ now: c.now }).bind({
      plan: fixture.plan,
      binding: {
        serviceRef: fixture.service,
        currentDeployRef: fixture.current,
        healthyDeployRef: fixture.healthy,
        [key]: value
      }
    }), /P07_RENDER_BINDING_FIELD_FORBIDDEN/, key);
  }
});

test('P07 Render contract rejects expired plans, replay and kill-switch state', () => {
  const c = clock();
  const fixture = buildPlan({ now: c.now });
  const binding = {
    serviceRef: fixture.service,
    currentDeployRef: fixture.current,
    healthyDeployRef: fixture.healthy
  };
  const contract = new SecurityP07RenderDryRunContract({ now: c.now });
  contract.bind({ plan: fixture.plan, binding });
  assert.throws(() => contract.bind({ plan: fixture.plan, binding }), /P07_RENDER_BINDING_REPLAY/);

  const c2 = clock();
  const expired = buildPlan({ now: c2.now });
  c2.advance(2 * 60 * 1000 + 1);
  assert.throws(() => new SecurityP07RenderDryRunContract({ now: c2.now }).bind({
    plan: expired.plan,
    binding: {
      serviceRef: expired.service,
      currentDeployRef: expired.current,
      healthyDeployRef: expired.healthy
    }
  }), /P07_RENDER_PLAN_EXPIRED/);

  const c3 = clock();
  const stopped = buildPlan({ now: c3.now });
  const stoppedContract = new SecurityP07RenderDryRunContract({ now: c3.now });
  stoppedContract.engageKillSwitch('P07_RENDER_STOP');
  assert.throws(() => stoppedContract.bind({
    plan: stopped.plan,
    binding: {
      serviceRef: stopped.service,
      currentDeployRef: stopped.current,
      healthyDeployRef: stopped.healthy
    }
  }), /P07_RENDER_KILL_SWITCH_ENGAGED/);
});

test('P07 Render descriptor and audit never expose raw refs, URLs, tokens or secrets', () => {
  const c = clock();
  const fixture = buildPlan({
    now: c.now,
    serviceRef: 'https://api.render.example/services/srv-prod?token=service-secret',
    currentDeployRef: 'render://deploy/current?credential=current-secret',
    healthyDeployRef: 'render://deploy/healthy?credential=healthy-secret'
  });
  const contract = new SecurityP07RenderDryRunContract({ now: c.now });
  const descriptor = contract.bind({
    plan: fixture.plan,
    binding: {
      serviceRef: fixture.service,
      currentDeployRef: fixture.current,
      healthyDeployRef: fixture.healthy
    }
  });
  const serialized = JSON.stringify({ descriptor, audit: contract.listAudit({ limit: 20 }), status: contract.status() });

  for (const forbidden of [
    fixture.service,
    fixture.current,
    fixture.healthy,
    'service-secret',
    'current-secret',
    'healthy-secret',
    'https://api.render.example'
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(serialized.includes('Authorization'), false);
  assert.equal(serialized.includes('Bearer'), false);
  for (const event of contract.listAudit({ limit: 20 })) {
    assert.equal(event.provider, 'render');
    assert.equal(event.adapterMode, 'contract_only');
    assert.equal(event.networkEnabled, false);
    assert.equal(event.credentialMode, 'none');
    assert.equal(event.externalWrite, false);
    assert.equal(event.authorized, false);
    assert.equal(event.executable, false);
    assert.equal(event.actionRunnerAvailable, false);
  }
});
