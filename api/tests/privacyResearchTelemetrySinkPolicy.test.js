const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_TELEMETRY_SINK_DECISIONS,
  evaluateResearchTelemetrySink
} = require('../config/researchTelemetrySinkPolicy');

test('Research telemetry sink policy is fail-closed by default', () => {
  const result = evaluateResearchTelemetrySink();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_TELEMETRY_SINK_DECISIONS);
});

test('Research telemetry sink requires explicit boolean decisions', () => {
  const decisions = Object.fromEntries(
    REQUIRED_TELEMETRY_SINK_DECISIONS.map((key) => [key, true])
  );
  decisions.storageEncryptionRequired = 'true';

  const result = evaluateResearchTelemetrySink(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['storageEncryptionRequired']);
});

test('Research telemetry sink rejects sensitive Research payload acceptance', () => {
  const decisions = Object.fromEntries(
    REQUIRED_TELEMETRY_SINK_DECISIONS.map((key) => [key, true])
  );
  decisions.noRawCitizenIdentifierAccepted = false;
  decisions.noPoliticalOpinionPayloadAccepted = false;

  const result = evaluateResearchTelemetrySink(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'noRawCitizenIdentifierAccepted',
    'noPoliticalOpinionPayloadAccepted'
  ]);
});

test('Research telemetry sink approves only after every safeguard is recorded', () => {
  const decisions = Object.fromEntries(
    REQUIRED_TELEMETRY_SINK_DECISIONS.map((key) => [key, true])
  );

  const result = evaluateResearchTelemetrySink(decisions);
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
