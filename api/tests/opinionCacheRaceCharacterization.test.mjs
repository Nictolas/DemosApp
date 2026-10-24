import test from 'node:test';
import assert from 'node:assert/strict';

// Characterization of a possible stale-response race in account-scoped caches.
// Synthetic deferred promises only; no real user data or network requests.
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('removing an opinion query does not itself cancel a detached in-flight request', async () => {
  const request = deferred();
  const entries = new Map();
  const key = 'opinioniQuestions|Nazionale|account-a';
  // Simulates a consumer that writes a late response after removeQueries.
  const pending = request.promise.then(value => entries.set(key, value));
  entries.delete(key); // removeQueries-equivalent without cancellation
  request.resolve({ userAnswer: 'f' });
  await pending;
  assert.equal(entries.get(key).userAnswer, 'f');
});

test('generation guard prevents a late response from restoring an old account snapshot', async () => {
  const request = deferred();
  const entries = new Map();
  let generation = 0;
  const startedAt = generation;
  const pending = request.promise.then(value => {
    if (generation === startedAt) entries.set('opinioniQuestions|Nazionale|account-a', value);
  });
  generation++; // logout, account change or revocation
  entries.clear();
  request.resolve({ userAnswer: 'f' });
  await pending;
  assert.equal(entries.size, 0);
});
