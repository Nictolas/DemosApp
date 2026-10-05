const test = require('node:test');
const assert = require('node:assert/strict');

const { createResearchFailureDiagnostics } = require('../services/researchFailureDiagnostics');

test('Research failure diagnostics are disabled by default', () => {
  let calls = 0;
  const diagnostics = createResearchFailureDiagnostics({ sink: () => { calls += 1; } });
  assert.equal(diagnostics.enabled, false);
  assert.equal(diagnostics.record({ kind: 'infrastructure' }), false);
  assert.equal(calls, 0);
});

test('enabled diagnostics emit only bounded category and unit count', () => {
  const events = [];
  const diagnostics = createResearchFailureDiagnostics({ enabled: true, sink: (event) => events.push(event) });
  const classification = { kind: 'policy', secret: 'E409_SECRET', payload: { userId: 'person-1' } };
  assert.equal(diagnostics.record(classification), true);
  assert.deepEqual(events, [{ kind: 'policy', count: 1 }]);
  assert.equal(JSON.stringify(events).includes('E409_SECRET'), false);
  assert.equal(JSON.stringify(events).includes('person-1'), false);
  assert.equal(Object.isFrozen(events[0]), true);
});

test('diagnostics isolate synchronous sink failures from Research flow', () => {
  const diagnostics = createResearchFailureDiagnostics({
    enabled: true,
    sink: () => { throw new Error('diagnostic consumer failed'); }
  });
  assert.doesNotThrow(() => diagnostics.record({ kind: 'infrastructure' }));
  assert.equal(diagnostics.record({ kind: 'infrastructure' }), false);
});

test('diagnostics never await asynchronous consumers or create backpressure', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const diagnostics = createResearchFailureDiagnostics({ enabled: true, sink: () => pending });
  assert.equal(diagnostics.record({ kind: 'policy' }), true);
  release();
  await pending;
});

test('diagnostics swallow asynchronous consumer rejection', async () => {
  const diagnostics = createResearchFailureDiagnostics({
    enabled: true,
    sink: () => Promise.reject(new Error('async diagnostic failure'))
  });
  assert.equal(diagnostics.record({ kind: 'request' }), true);
  await new Promise((resolve) => setImmediate(resolve));
});

test('diagnostics enforce a bounded event budget during failure storms', () => {
  const events = [];
  const diagnostics = createResearchFailureDiagnostics({
    enabled: true,
    eventBudget: 3,
    sink: (event) => events.push(event)
  });
  for (let index = 0; index < 50; index += 1) diagnostics.record({ kind: 'infrastructure' });
  assert.equal(events.length, 3);
  assert.equal(diagnostics.record({ kind: 'request' }), false);
});

test('invalid or excessive diagnostic budgets disable the sink fail-closed', () => {
  for (const eventBudget of [0, -1, 1.5, 1001, Number.MAX_SAFE_INTEGER, '10']) {
    let calls = 0;
    const diagnostics = createResearchFailureDiagnostics({ enabled: true, eventBudget, sink: () => { calls += 1; } });
    assert.equal(diagnostics.enabled, false);
    assert.equal(diagnostics.record({ kind: 'policy' }), false);
    assert.equal(calls, 0);
  }
});

test('failed synchronous emissions still consume budget to prevent retry amplification', () => {
  let calls = 0;
  const diagnostics = createResearchFailureDiagnostics({
    enabled: true,
    eventBudget: 2,
    sink: () => { calls += 1; throw new Error('consumer failed'); }
  });
  diagnostics.record({ kind: 'request' });
  diagnostics.record({ kind: 'request' });
  diagnostics.record({ kind: 'request' });
  assert.equal(calls, 2);
});

test('diagnostics reject unknown categories and invalid sinks fail closed', () => {
  const events = [];
  const diagnostics = createResearchFailureDiagnostics({ enabled: true, sink: (event) => events.push(event) });
  assert.equal(diagnostics.record({ kind: 'unexpected' }), false);
  assert.deepEqual(events, []);
  assert.equal(createResearchFailureDiagnostics({ enabled: true }).enabled, false);
});
