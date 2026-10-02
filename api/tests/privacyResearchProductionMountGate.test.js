const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_RESEARCH_PRODUCTION_DECISIONS } = require('../config/researchProductionReadinessPolicy');
const { mountResearchPublicApiIfProductionReady } = require('../researchProductionMountGate');

const approved = Object.freeze({ approved: true, blockers: Object.freeze([]) });
const allReady = () => Object.fromEntries(
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
);
const evidence = {
  researchDatabaseConfiguration: approved,
  researchSchemaValidation: approved,
  researchSastEvidence: approved,
  rateLimitSecretLifecycle: approved,
  distributedRateLimitProvider: approved,
  telemetryRetention: approved,
  telemetrySink: approved,
  publicOrigins: approved
};

test('Research production mount gate blocks without SAST evidence', () => {
  let mountCalls = 0;
  const { researchSastEvidence, ...withoutSast } = evidence;
  const result = mountResearchPublicApiIfProductionReady({ use() {} }, {
    decisions: allReady(),
    ...withoutSast,
    mount() { mountCalls += 1; return { mounted: true }; }
  });
  assert.equal(result.mounted, false);
  assert.deepEqual(result.blockers, ['researchSastCleared']);
  assert.equal(mountCalls, 0);
});

test('Research production mount gate delegates only after all readiness checks pass', () => {
  const app = { use() {} };
  let mountCalls = 0;
  const result = mountResearchPublicApiIfProductionReady(app, {
    decisions: allReady(),
    ...evidence,
    mount(receivedApp) {
      mountCalls += 1;
      assert.equal(receivedApp, app);
      return { mounted: true };
    }
  });
  assert.equal(result.mounted, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(mountCalls, 1);
});
