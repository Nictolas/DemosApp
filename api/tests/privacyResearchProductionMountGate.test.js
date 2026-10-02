const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS
} = require('../config/researchProductionReadinessPolicy');
const {
  mountResearchPublicApiIfProductionReady
} = require('../researchProductionMountGate');

const allReady = () => Object.fromEntries(
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
);
const approvedLifecycle = Object.freeze({ approved: true, blockers: Object.freeze([]) });

test('Research production mount gate blocks mounting when any prerequisite is missing', () => {
  const decisions = allReady();
  decisions.globalSastDebtCleared = false;

  let mountCalls = 0;
  const result = mountResearchPublicApiIfProductionReady(
    { use() {} },
    {
      decisions,
      rateLimitSecretLifecycle: approvedLifecycle,
      mount() {
        mountCalls += 1;
        return { mounted: true };
      }
    }
  );

  assert.equal(result.mounted, false);
  assert.deepEqual(result.blockers, ['globalSastDebtCleared']);
  assert.equal(mountCalls, 0);
});

test('Research production mount gate blocks separately for every required prerequisite', () => {
  for (const missing of REQUIRED_RESEARCH_PRODUCTION_DECISIONS) {
    const decisions = allReady();
    decisions[missing] = false;

    let mountCalls = 0;
    const result = mountResearchPublicApiIfProductionReady(
      { use() {} },
      {
        decisions,
        rateLimitSecretLifecycle: approvedLifecycle,
        mount() {
          mountCalls += 1;
          return { mounted: true };
        }
      }
    );

    assert.equal(result.mounted, false, missing);
    assert.deepEqual(result.blockers, [missing], missing);
    assert.equal(mountCalls, 0, missing);
  }
});

test('Research production mount gate blocks without approved secret lifecycle evidence', () => {
  let mountCalls = 0;
  const result = mountResearchPublicApiIfProductionReady(
    { use() {} },
    {
      decisions: allReady(),
      mount() {
        mountCalls += 1;
        return { mounted: true };
      }
    }
  );

  assert.equal(result.mounted, false);
  assert.deepEqual(result.blockers, ['rateLimitSecretLifecycleApproved']);
  assert.equal(mountCalls, 0);
});

test('Research production mount gate delegates only after all readiness checks pass', () => {
  const app = { use() {} };
  const mountOptions = {
    policy: {
      mountAllowed: true,
      allowedOrigins: ['https://app.example']
    }
  };
  const calls = [];

  const result = mountResearchPublicApiIfProductionReady(
    app,
    {
      decisions: allReady(),
      rateLimitSecretLifecycle: approvedLifecycle,
      mount(receivedApp, receivedOptions) {
        calls.push({ receivedApp, receivedOptions });
        return { mounted: true };
      },
      mountOptions
    }
  );

  assert.equal(result.mounted, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].receivedApp, app);
  assert.equal(calls[0].receivedOptions, mountOptions);
});
