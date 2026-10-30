import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Exercise the actual production ACK gate. The transport is deliberately
// replaced with a deterministic synthetic handler; no authenticated data
// or Supabase requests are issued by this test.
const source = readFileSync(
  new URL('../src/lib/saveAndVerifyOpinions.ts', import.meta.url), 'utf8'
);
const executable = stripTypeScriptTypes(source)
  .replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?/gm, '')
  .replace(/^export\s+/gm, '');

function fixture(response = { ok: true, data: { success: true, savedCount: 1, errorCount: 0 } }) {
  const requests = [];
  const apiRequest = async (...args) => {
    requests.push(args);
    if (typeof response === 'function') return response(...args);
    if (response instanceof Error) throw response;
    return response;
  };
  const sandbox = { apiRequest };
  vm.runInNewContext(executable + '\nthis.save = saveAndVerifyOpinions;', sandbox, {
    filename: 'saveAndVerifyOpinions.ts',
  });
  return { save: sandbox.save, requests };
}

test('fully acknowledged delta issues exactly one POST and zero verification GETs', async () => {
  const h = fixture({ ok: true, data: { success: true, savedCount: 2, errorCount: 0 } });
  await h.save('CO', { synthetic_opinion_01: 'f', synthetic_opinion_02: 'i' });
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.requests[0].slice(0, 2), ['POST', '/api/opinioni/salva']);
  assert.deepEqual({ ...h.requests[0][2].opinioni }, {
    synthetic_opinion_01: 'f',
    synthetic_opinion_02: 'i',
  });
});

test('empty delta is rejected before any network request', async () => {
  const h = fixture();
  await assert.rejects(h.save('N', {}), /Nessuna risposta modificata valida/);
  assert.equal(h.requests.length, 0);
});

test('invalid or unselected values are rejected before a network request', async () => {
  for (const value of ['Astenuto', '', 'x', null]) {
    const h = fixture();
    await assert.rejects(h.save('N', { synthetic_opinion_01: value }),
      /Nessuna risposta modificata valida/);
    assert.equal(h.requests.length, 0);
  }
});

test('partial server ACK is rejected without a GET verification fallback', async () => {
  const h = fixture({ ok: true, data: { success: true, savedCount: 1, errorCount: 0 } });
  await assert.rejects(h.save('E', { synthetic_opinion_01: 'f', synthetic_opinion_02: 'c' }),
    /Il server non ha confermato/);
  assert.equal(h.requests.length, 1);
});

test('server-reported write errors cannot confirm the local political snapshot', async () => {
  const h = fixture({ ok: true, data: { success: true, savedCount: 1, errorCount: 1 } });
  await assert.rejects(h.save('R', { synthetic_opinion_01: 'f' }),
    /Il server non ha confermato/);
  assert.equal(h.requests.length, 1);
});

test('HTTP error and explicit success=false do not confirm any local answer', async () => {
  for (const response of [
    { ok: false, data: { success: true, savedCount: 1, errorCount: 0 } },
    { ok: true, data: { success: false, savedCount: 1, errorCount: 0 } },
  ]) {
    const h = fixture(response);
    await assert.rejects(h.save('CO', { synthetic_opinion_01: 'f' }),
      /Il server non ha confermato/);
    assert.equal(h.requests.length, 1);
  }
});

test('missing, malformed and mismatched ACK counts reject the save', async () => {
  for (const count of [undefined, null, 0, -1, 2, 'not-a-number']) {
    const h = fixture({ ok: true, data: { success: true, savedCount: count } });
    await assert.rejects(h.save('N', { synthetic_opinion_01: 'c' }),
      /Il server non ha confermato/);
    assert.equal(h.requests.length, 1);
  }
});

test('network failure propagates without an automatic replay or an extra GET', async () => {
  const h = fixture(new Error('Synthetic network outage'));
  await assert.rejects(h.save('CO', { synthetic_opinion_01: 'i' }),
    /Synthetic network outage/);
  assert.equal(h.requests.length, 1);
});

test('no stale fallback server read occurs when POST fails', async () => {
  const h = fixture(async (method, path) => {
    assert.equal(method, 'POST');
    assert.equal(path, '/api/opinioni/salva');
    throw new Error('Synthetic backend 503');
  });
  await assert.rejects(h.save('E', { synthetic_opinion_01: 'f' }),
    /Synthetic backend 503/);
  assert.equal(h.requests.length, 1);
});
