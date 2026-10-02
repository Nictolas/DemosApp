const test = require('node:test');
const assert = require('node:assert/strict');

const { REQUIRED_RESEARCH_PRODUCTION_DECISIONS } = require('../config/researchProductionReadinessPolicy');
const { mountResearchPublicApiIfProductionReady } = require('../researchProductionMountGate');

const allReady = () => Object.fromEntries(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true]));
const approved = Object.freeze({ approved: true, blockers: Object.freeze([]) });
const evidence = {
  rateLimitSecretLifecycle: approved,
  distributedRateLimitProvider: approved,
  telemetryRetention: approved
};

test('Research production mount gate blocks mounting when any prerequisite is missing', () => {
  const decisions = allReady();
  decisions.globalSastDebtCleared = false;
  let mountCalls = 0;
  const result = mountResearchPublicApiIfProductionReady({ use() {} }, {
    decisions,
    ...evidence,
    mount() { mountCalls += 1; return { mounted: true }; }
  });
  assert.equal(result.mounted, false);
  assert.deepEqual(result.blockers, ['globalSastDebtCleared']);
  assert.equal(mountCalls, 0);
});

test('Research production mount gate blocks without telemetry retention evidence', () => {
  let mountCalls = 0;
  const result = mountResearchPublicApiIfProductionReady({ use() {} }, {
    decisions: allReady(),
    rateLimitSecretLifecycle: approved,
    distributedRateLimitProvider: approved,
    mount() { mountCalls += 1; return { mounted: true }; }
  });
  assert.equal(result.mounted, false);
  assert.deepEqual(result.blockers, ['telemetryRetentionApproved']);
  assert.equal(mountCalls, 0);
});

test('Research production mount gate delegates only after all readiness checks pass', () => {
  const app = { use() {} };
  const calls = [];
  const result = mountResearchPublicApiIfProductionReady(app, {
    decisions: allReady(),
    ...evidence,
    mount(receivedApp) { calls.push(receivedApp); return { mounted: true }; }
  });
  assert.equal(result.mounted, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], app);
});
