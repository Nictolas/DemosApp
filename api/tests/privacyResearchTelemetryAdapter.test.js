const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createResearchTelemetryAdapter
} = require('../services/researchTelemetryAdapter');

test('Research telemetry adapter sends only sanitized metadata to injected sink', () => {
  const emitted = [];
  const telemetry = createResearchTelemetryAdapter({
    sink: (event) => emitted.push(event)
  });

  assert.equal(telemetry.emit({
    event: 'research-read',
    status: 200,
    method: 'POST',
    route: '/v1/opinion-vector/read',
    participantPublicKey: 'key-material',
    challenge: 'challenge-material',
    signature: 'signature-material',
    authorization: 'Bearer secret',
    opinions: { q1: 'f' }
  }), true);

  assert.deepEqual(emitted, [{
    event: 'research-read',
    status: 200,
    route: '/v1/opinion-vector/read',
    method: 'POST'
  }]);
  const serialized = JSON.stringify(emitted);
  for (const secret of ['key-material', 'challenge-material', 'signature-material', 'Bearer secret', 'q1']) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('Research telemetry adapter drops events with no allowed metadata', () => {
  let calls = 0;
  const telemetry = createResearchTelemetryAdapter({ sink: () => { calls += 1; } });
  assert.equal(telemetry.emit({ authorization: 'Bearer secret', opinions: { q1: 'f' } }), false);
  assert.equal(calls, 0);
});

test('Research telemetry adapter requires explicit sink and has no implicit console logger', () => {
  assert.throws(() => createResearchTelemetryAdapter({}), /sink is required/);
});
