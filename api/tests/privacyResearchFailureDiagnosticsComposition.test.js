const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_FAILURE_KIND,
  classifyResearchFailure
} = require('../services/researchFailureClassification');
const {
  createResearchFailureDiagnostics,
  DIAGNOSTICS_ENABLE_TOKEN
} = require('../services/researchFailureDiagnostics');

const emit = (error, sink) => {
  const diagnostics = createResearchFailureDiagnostics({
    enableToken: DIAGNOSTICS_ENABLE_TOKEN,
    eventBudget: 10,
    sink
  });
  return diagnostics.record(classifyResearchFailure(error));
};

test('classification-to-diagnostics composition emits only kind and unit count', () => {
  const events = [];
  const error = new Error('connect failed password=E419_SECRET host=private-db.internal');
  error.cause = { token: 'E419_TOKEN', participantId: 'person-42' };
  error.stack = 'E419_STACK';
  assert.equal(emit(error, (event) => events.push(event)), true);
  assert.deepEqual(events, [{ kind: RESEARCH_FAILURE_KIND.REQUEST, count: 1 }]);
  const serialized = JSON.stringify(events);
  for (const forbidden of ['E419_SECRET', 'private-db.internal', 'E419_TOKEN', 'person-42', 'E419_STACK']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('known infrastructure classification remains category-only at diagnostics sink', () => {
  const events = [];
  const error = new Error('Research database unavailable');
  error.connection = 'postgres://user:E419_PASSWORD@secret-host/research';
  emit(error, (event) => events.push(event));
  assert.deepEqual(events, [{ kind: RESEARCH_FAILURE_KIND.INFRASTRUCTURE, count: 1 }]);
  assert.equal(JSON.stringify(events).includes('E419_PASSWORD'), false);
});

test('known policy classification remains category-only at diagnostics sink', () => {
  const events = [];
  const error = new Error('privacy threshold not met');
  error.policy = { minimumCellSize: 5, rawPayload: 'E419_POLICY_SECRET' };
  emit(error, (event) => events.push(event));
  assert.deepEqual(events, [{ kind: RESEARCH_FAILURE_KIND.POLICY, count: 1 }]);
  assert.equal(JSON.stringify(events).includes('E419_POLICY_SECRET'), false);
});

test('composition preserves bounded diagnostics behavior under repeated rich errors', () => {
  const events = [];
  const diagnostics = createResearchFailureDiagnostics({
    enableToken: DIAGNOSTICS_ENABLE_TOKEN,
    eventBudget: 2,
    sink: (event) => events.push(event)
  });
  for (let index = 0; index < 20; index += 1) {
    const error = new Error(`request failed secret-${index}`);
    error.payload = { participantId: `person-${index}` };
    diagnostics.record(classifyResearchFailure(error));
  }
  assert.equal(events.length, 2);
  assert.deepEqual(events, [
    { kind: RESEARCH_FAILURE_KIND.REQUEST, count: 1 },
    { kind: RESEARCH_FAILURE_KIND.REQUEST, count: 1 }
  ]);
});
