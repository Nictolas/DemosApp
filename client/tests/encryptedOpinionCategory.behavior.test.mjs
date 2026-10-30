import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { parseOpinionQuestions } from '../src/lib/opinionPayload.ts';

// Test the production implementation without browser, network, Supabase or an
// installed bundler. Only the transport and encrypted vault are mocked.
const moduleSource = readFileSync(
  new URL('../src/lib/encryptedOpinionCache.ts', import.meta.url), 'utf8'
);
const executable = stripTypeScriptTypes(moduleSource)
  .replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?/gm, '')
  .replace(/^export\s+/gm, '');

const A = 'synthetic-account-A';
const B = 'synthetic-account-B';
const q = [{ id: 'valid_opinion', text: 'Synthetic question', grado: ['N'], userAnswer: 'f' }];

function fixture() {
  let now = 0;
  let currentRevision = 'a'.repeat(64);
  let answerReads = 0;
  let catalogReads = 0;
  let storeWrites = 0;
  let afterGet = () => {};
  let lastSignal;
  const snapshots = new Map();
  const generations = new Map();
  const revision = (owner, section) => String(generations.get(owner + ':' + section) || 0);
  const bump = (owner, section) => generations.set(owner + ':' + section,
    Number(revision(owner, section)) + 1);
  const apiRequest = async (method, url, _body, _headers, signal) => {
    assert.equal(method, 'GET');
    if (url === '/api/opinioni-catalog-revision') {
      catalogReads += 1;
      return { ok: true, data: { success: true, revision: currentRevision } };
    }
    assert.equal(url, '/api/opinioni-list?grado=N');
    answerReads += 1;
    lastSignal = signal;
    await afterGet(signal);
    return { ok: true, data: { success: true, data: q } };
  };
  const persistEncryptedOpinionCategory = async (owner, consentEpoch, section, category, expectedRevision) => {
    assert.equal(revision(owner, section), expectedRevision,
      'An outdated completion cannot persist an old answer snapshot');
    storeWrites += 1;
    snapshots.set(owner, {
      ...snapshots.get(owner),
      consent: { granted: true, timestamp: consentEpoch },
      [section]: category,
    });
  };
  const sandbox = {
    Date: class extends Date { static now() { return now; } },
    apiRequest,
    parseOpinionQuestions,
    loadEncryptedProfile: async owner => snapshots.get(owner) || null,
    persistEncryptedOpinionCategory,
    mergeEncryptedOpinionAnswers: async () => {},
    profileSectionRevision: revision,
  };
  vm.runInNewContext(executable + '\nthis.cache = { loadOpinionCategory, cacheConfirmedOpinionAnswers };',
    sandbox, { filename: 'encryptedOpinionCache.ts' });
  return {
    load: sandbox.cache.loadOpinionCategory,
    snapshots, bump,
    setRevision: value => { currentRevision = value; },
    advance: milliseconds => { now += milliseconds; },
    onGet: fn => { afterGet = fn; },
    counts: () => ({ answers: answerReads, catalog: catalogReads, writes: storeWrites }),
    signal: () => lastSignal,
  };
}

test('warm encrypted cache avoids another personal-answer GET after a cold fetch', async () => {
  const h = fixture();
  const first = await h.load(A, 'consent-1', 'N');
  assert.equal(first.data[0].userAnswer, 'f');
  assert.deepEqual(h.counts(), { answers: 1, catalog: 1, writes: 1 });
  const warm = await h.load(A, 'consent-1', 'N');
  assert.equal(warm.data[0].id, q[0].id);
  assert.deepEqual(h.counts(), { answers: 1, catalog: 1, writes: 1 });
});

test('invalid cached IDs are rejected and replaced with an authenticated GET', async () => {
  const h = fixture();
  await h.load(A, 'consent-1', 'N');
  h.snapshots.get(A).opinionN.questions[0].id = 'invalid-slug';
  const after = await h.load(A, 'consent-1', 'N');
  assert.equal(after.data[0].id, 'valid_opinion');
  assert.equal(h.counts().answers, 2);
});

test('consent epoch and account boundary each require their own answer GET', async () => {
  const h = fixture();
  await h.load(A, 'consent-1', 'N');
  await h.load(A, 'consent-2', 'N');
  await h.load(B, 'consent-1', 'N');
  assert.equal(h.counts().answers, 3);
  assert.equal(h.snapshots.get(A).consent.timestamp, 'consent-2');
  assert.equal(h.snapshots.get(B).consent.timestamp, 'consent-1');
});

test('catalog release change invalidates the warm cache after the metadata TTL', async () => {
  const h = fixture();
  await h.load(A, 'consent-1', 'N');
  h.advance(300001);
  h.setRevision('b'.repeat(64));
  await h.load(A, 'consent-1', 'N');
  assert.deepEqual(h.counts(), { answers: 2, catalog: 2, writes: 2 });
});

test('aborted cold GET is cancelled and cannot persist political answers', async () => {
  const h = fixture();
  const ac = new AbortController();
  h.onGet(() => { ac.abort(); });
  await assert.rejects(h.load(A, 'consent-1', 'N', ac.signal),
    /Caricamento opinioni annullato/);
  assert.equal(h.signal(), ac.signal, 'the actual HTTP helper receives AbortSignal');
  assert.equal(h.counts().writes, 0);
});

test('consent/revision race rejects a stale answer GET before disk write', async () => {
  const h = fixture();
  h.onGet(() => { h.bump(A, 'opinionN'); });
  await assert.rejects(h.load(A, 'consent-1', 'N'), /Caricamento opinioni annullato/);
  assert.equal(h.counts().writes, 0);
});
