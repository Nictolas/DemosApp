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
  let beforeCatalog = () => {};
  let beforePersist = () => {};
  let catalogAvailable = true;
  let personalAnswersAvailable = true;
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
      await beforeCatalog();
      if (!catalogAvailable) throw new Error('Synthetic catalog metadata unavailable');
      return { ok: true, data: { success: true, revision: currentRevision } };
    }
    assert.equal(url, '/api/opinioni-list?grado=N');
    answerReads += 1;
    lastSignal = signal;
    if (!personalAnswersAvailable) throw new Error('Synthetic personal answer API unavailable');
    await afterGet(signal);
    return { ok: true, data: { success: true, data: q } };
  };
  const persistEncryptedOpinionCategory = async (owner, consentEpoch, section, category, expectedRevision) => {
    await beforePersist();
    // The real encrypted vault discards a queued write whose epoch/revision
    // changed while waiting; it does not throw an exception for that skip.
    if (revision(owner, section) !== expectedRevision) return;
    storeWrites += 1;
    snapshots.set(owner, {
      ...snapshots.get(owner),
      consent: { granted: true, timestamp: consentEpoch },
      [section]: category,
    });
  };
  const mergeEncryptedOpinionAnswers = async (owner, consentEpoch, confirmedAnswers) => {
    // Simulate the vault's commit-only merge across four shared grades, with
    // the SAME revision barrier used by the production vault. No server GET.
    const names = ['opinionE', 'opinionN', 'opinionR', 'opinionCO'];
    for (const name of names) bump(owner, name);
    const old = snapshots.get(owner);
    if (!old?.consent?.granted || old.consent.timestamp !== consentEpoch) return;
    const next = { ...old };
    for (const name of names) {
      if (!old[name]) continue;
      next[name] = {
        ...old[name],
        questions: old[name].questions.map(question => {
          const answer = confirmedAnswers[question.id];
          return ['f', 'c', 'i'].includes(answer)
            ? { ...question, userAnswer: answer } : question;
        }),
      };
    }
    snapshots.set(owner, next);
  };
  const sandbox = {
    Date: class extends Date { static now() { return now; } },
    apiRequest,
    parseOpinionQuestions,
    loadEncryptedProfile: async owner => snapshots.get(owner) || null,
    persistEncryptedOpinionCategory,
    mergeEncryptedOpinionAnswers,
    profileSectionRevision: revision,
  };
  vm.runInNewContext(executable + '\nthis.cache = { loadOpinionCategory, cacheConfirmedOpinionAnswers };',
    sandbox, { filename: 'encryptedOpinionCache.ts' });
  return {
    load: sandbox.cache.loadOpinionCategory,
    confirm: sandbox.cache.cacheConfirmedOpinionAnswers,
    snapshots, bump,
    setRevision: value => { currentRevision = value; },
    advance: milliseconds => { now += milliseconds; },
    onGet: fn => { afterGet = fn; },
    onCatalog: fn => { beforeCatalog = fn; },
    onPersist: fn => { beforePersist = fn; },
    setCatalogAvailable: ok => { catalogAvailable = ok; },
    setPersonalAnswersAvailable: ok => { personalAnswersAvailable = ok; },
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

test('simultaneous accounts coalesce the public catalog revision request', async () => {
  const h = fixture();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  h.onCatalog(() => gate);
  const first = h.load(A, 'consent-1', 'N');
  const second = h.load(B, 'consent-1', 'N');
  // Both calls must join one in-flight public revision request, but each
  // account's private answers still require their own authenticated GET.
  assert.equal(h.counts().catalog, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.data[0].id, 'valid_opinion');
  assert.equal(b.data[0].id, 'valid_opinion');
  assert.deepEqual(h.counts(), { answers: 2, catalog: 1, writes: 2 });
});

test('unavailable public catalog revision never authorizes reusing a stale snapshot', async () => {
  const h = fixture();
  await h.load(A, 'consent-1', 'N');
  assert.equal(h.counts().writes, 1);
  h.advance(300001);
  h.setCatalogAvailable(false);
  await h.load(A, 'consent-1', 'N');
  // Without the current official catalog revision, fail closed on cached
  // responses: fetch the authenticated server's current answer payload.
  assert.deepEqual(h.counts(), { answers: 2, catalog: 2, writes: 1 });
  h.setPersonalAnswersAvailable(false);
  await assert.rejects(h.load(A, 'consent-1', 'N'),
    /Synthetic personal answer API unavailable/);
  assert.deepEqual(h.counts(), { answers: 3, catalog: 3, writes: 1 });
});

test('a late personal GET cannot overwrite an acknowledged save in another grade', async () => {
  const h = fixture();
  // Prime a real category snapshot, then force a catalog revision refresh.
  await h.load(A, 'consent-1', 'N');
  assert.equal(h.snapshots.get(A).opinionN.questions[0].userAnswer, 'f');
  h.advance(300001);
  h.setRevision('b'.repeat(64));

  let resumeGet;
  let getStarted;
  const pendingGetStarted = new Promise(resolve => { getStarted = resolve; });
  const gate = new Promise(resolve => { resumeGet = resolve; });
  h.onGet(() => { getStarted(); return gate; });
  const staleGet = h.load(A, 'consent-1', 'N');
  await pendingGetStarted;

  const beforeSave = h.counts();
  await h.confirm(A, 'consent-1', { valid_opinion: 'c' });
  assert.equal(h.counts().answers, beforeSave.answers,
    'An acknowledged cross-grade answer must not cause a new personal GET');
  assert.equal(h.snapshots.get(A).opinionN.questions[0].userAnswer, 'c',
    'The acknowledged answer replaces the old local response');

  resumeGet();
  await assert.rejects(staleGet, /Caricamento opinioni annullato/,
    'The old response must fail its revision guard, never return stale answers');
  assert.equal(h.snapshots.get(A).opinionN.questions[0].userAnswer, 'c',
    'The old in-flight GET must not restore the pre-save snapshot');
  assert.equal(h.counts().writes, 1,
    'The pending GET must not overwrite the encrypted profile after ACK');
});

test('a confirmed answer cannot be cached under an old consent epoch', async () => {
  const h = fixture();
  await h.load(A, 'consent-1', 'N');
  await h.confirm(A, 'consent-2', { valid_opinion: 'c' });
  assert.equal(h.snapshots.get(A).opinionN.questions[0].userAnswer, 'f',
    'A stale or unrelated authorization epoch cannot modify the encrypted cache');
  assert.equal(h.counts().answers, 1, 'No private GET is triggered by local ACK sync');
});

test('revocation during queued vault write cannot return a stale GET payload', async () => {
  const h = fixture();
  let releaseWrite;
  let reachedWrite;
  const writeStarted = new Promise(resolve => { reachedWrite = resolve; });
  const gate = new Promise(resolve => { releaseWrite = resolve; });
  h.onPersist(() => { reachedWrite(); return gate; });

  const pending = h.load(A, 'consent-1', 'N');
  await writeStarted;
  h.bump(A, 'opinionN'); // verified revoke advances the vault generation
  releaseWrite();

  await assert.rejects(pending, /Caricamento opinioni annullato/);
  assert.equal(h.counts().writes, 0, 'The revoked snapshot must not be persisted');
  assert.equal(h.counts().answers, 1, 'The stale request is not retried');
});

test('abort during queued encrypted write cancels the result returned to React Query', async () => {
  const h = fixture();
  const ac = new AbortController();
  let releaseWrite;
  let reachedWrite;
  const writeStarted = new Promise(resolve => { reachedWrite = resolve; });
  const gate = new Promise(resolve => { releaseWrite = resolve; });
  h.onPersist(() => { reachedWrite(); return gate; });

  const pending = h.load(A, 'consent-1', 'N', ac.signal);
  await writeStarted;
  ac.abort();
  releaseWrite();

  await assert.rejects(pending, /Caricamento opinioni annullato/);
  assert.equal(h.signal(), ac.signal);
  assert.equal(h.counts().answers, 1);
});

test('blank or whitespace-only consent epochs forbid personal GETs and cache reuse', async () => {
  const h = fixture();
  await h.load(A, 'consent-1', 'N');
  assert.equal(h.counts().answers, 1);
  for (const epoch of [null, '', '   ']) {
    await assert.rejects(h.load(A, epoch, 'N'), /consenso non verificati/);
  }
  assert.equal(h.counts().answers, 1,
    'Unverifiable consent epochs must not issue a personal answer GET');
  assert.equal(h.counts().catalog, 1,
    'Reject without even fetching public catalog metadata');
  assert.equal(h.counts().writes, 1,
    'No encrypted snapshot may be written with a blank consent epoch');
  assert.equal(h.snapshots.get(A).consent.timestamp, 'consent-1');
});

test('blank consent epochs cannot mutate a confirmed answer in encrypted storage', async () => {
  const h = fixture();
  await h.load(A, 'consent-1', 'N');
  for (const epoch of [null, '', '  ']) {
    await h.confirm(A, epoch, { valid_opinion: 'c' });
    assert.equal(h.snapshots.get(A).opinionN.questions[0].userAnswer, 'f',
      'Unverified epoch must not modify stored political answers');
  }
  assert.deepEqual(h.counts(), { answers: 1, catalog: 1, writes: 1 });
});
