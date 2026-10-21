const test = require('node:test');
const assert = require('node:assert/strict');

const { createFailureReporter } = require('../utils/logDeliveryFailureReporter');

test('reports initial Axiom delivery failure without logging sensitive payloads', () => {
  const emitted = [];
  const report = createFailureReporter({
    clock: () => 1000,
    emit: (...parts) => emitted.push(parts)
  });
  assert.equal(report(403), true);
  assert.deepEqual(emitted, [
    ['AXIOM_INGEST_FAILURE', { httpStatus: 403, failedAttemptsSinceLastWarning: 1 }]
  ]);
});

test('throttles repeated failures and includes their number in the next warning', () => {
  const emitted = [];
  let now = 0;
  const report = createFailureReporter({
    clock: () => now,
    intervalMs: 300000,
    emit: (...parts) => emitted.push(parts)
  });

  assert.equal(report(503), true);
  now = 1000;
  assert.equal(report(503), false);
  now = 299999;
  assert.equal(report(503), false);
  assert.equal(emitted.length, 1);
  now = 300000;
  assert.equal(report(429), true);
  assert.deepEqual(emitted[1], [
    'AXIOM_INGEST_FAILURE',
    { httpStatus: 429, failedAttemptsSinceLastWarning: 3 }
  ]);
});

test('does not leak unexpected HTTP status content', () => {
  const emitted = [];
  const report = createFailureReporter({
    emit: (...parts) => emitted.push(parts)
  });

  report('token or error string');
  assert.deepEqual(emitted[0], [
    'AXIOM_INGEST_FAILURE',
    { httpStatus: null, failedAttemptsSinceLastWarning: 1 }
  ]);
});
