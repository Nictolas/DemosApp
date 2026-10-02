const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_TELEMETRY_RETENTION_DECISIONS,
  evaluateResearchTelemetryRetention
} = require('../config/researchTelemetryRetentionPolicy');

test('Research telemetry retention policy is fail-closed by default', () => {
  const result = evaluateResearchTelemetryRetention();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_TELEMETRY_RETENTION_DECISIONS);
});

test('Research telemetry retention requires explicit boolean decisions', () => {
  const decisions = Object.fromEntries(
    REQUIRED_TELEMETRY_RETENTION_DECISIONS.map((key) => [key, true])
  );
  decisions.automaticExpiryEnforced = 'true';

  const result = evaluateResearchTelemetryRetention(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['automaticExpiryEnforced']);
});

test('Research telemetry retention rejects sensitive-content retention', () => {
  const decisions = Object.fromEntries(
    REQUIRED_TELEMETRY_RETENTION_DECISIONS.map((key) => [key, true])
  );
  decisions.noRawCitizenIdentifierRetained = false;
  decisions.noPoliticalOpinionPayloadRetained = false;

  const result = evaluateResearchTelemetryRetention(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'noRawCitizenIdentifierRetained',
    'noPoliticalOpinionPayloadRetained'
  ]);
});

test('Research telemetry retention approves only after every safeguard is recorded', () => {
  const decisions = Object.fromEntries(
    REQUIRED_TELEMETRY_RETENTION_DECISIONS.map((key) => [key, true])
  );

  const result = evaluateResearchTelemetryRetention(decisions);
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
