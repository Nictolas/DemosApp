'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizePublishedDelta,
  sanitizeStoredDocument,
  planAnswerDelta,
  SQL
} = require('../experiments/opinionAnswersV2Candidate');

const catalog94 = new Set(Array.from({length:94}, (_,i)=>'opinione_' + i));
const archived = 'opinione_archiviata';

test('95th published opinion needs only a new catalog ID, no answer-table column', () => {
  const published = new Set([...catalog94, 'opinione_94']);
  const result = planAnswerDelta({ opinione_0: 'f' }, { opinione_94: 'i' }, published);
  assert.equal(result.changedCount, 1);
  assert.equal(result.merged.opinione_94, 'i');
  assert.equal(result.merged.opinione_0, 'f');
  assert.ok(!SQL.upsertPatch.includes('opinione_94'));
});

test('unpublished historical answer remains available but cannot be overwritten', () => {
  const current = { [archived]: 'c', opinione_0: 'f' };
  const result = planAnswerDelta(current, { opinione_0: 'i' }, catalog94);
  assert.equal(result.merged[archived], 'c');
  assert.throws(
    () => planAnswerDelta(current, { [archived]: 'f' }, catalog94),
    /unpublished/
  );
});

test('delta changes only submitted IDs and never discards independent changes', () => {
  const base = { opinione_0: 'f', opinione_1: 'c' };
  const result = planAnswerDelta(base, { opinione_0: 'i' }, catalog94);
  assert.deepEqual({ ...result.changed }, { opinione_0: 'i' });
  assert.deepEqual({ ...result.merged }, { opinione_0: 'i', opinione_1: 'c' });
  assert.match(SQL.upsertPatch, /existing\.answers \|\| EXCLUDED\.answers/);
  assert.doesNotMatch(SQL.upsertPatch, /SET\s+answers\s*=\s*EXCLUDED\.answers/i);
});

test('no-op produces zero changed fields and zero notifications', () => {
  const result = planAnswerDelta({ opinione_0: 'f' }, { opinione_0: 'f' }, catalog94);
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.changedCount, 0);
  assert.equal(result.notifications.length, 0);
  assert.deepEqual({ ...result.changed }, {});
});

test('first answer does not trigger a change-of-position notification', () => {
  const first = planAnswerDelta({}, { opinione_0: 'f' }, catalog94);
  const changed = planAnswerDelta({ opinione_0: 'f' }, { opinione_0: 'c' }, catalog94);
  assert.deepEqual(first.firstAnswers, ['opinione_0']);
  assert.equal(first.notifications.length, 0);
  assert.deepEqual(changed.notifications, [
    {opinionId:'opinione_0', previousValue:'f', newValue:'c'}
  ]);
});

test('rejects invalid, NULL, unknown and prototype-like IDs before SQL', () => {
  for (const invalid of [null, undefined, '', 'F', 'non lo so', 0, false]) {
    assert.throws(() => sanitizePublishedDelta({ opinione_0: invalid }, catalog94));
  }
  for (const id of ['constructor', '__proto__', 'x";DROP', 'opinione_94']) {
    assert.throws(() => sanitizePublishedDelta({ [id]: 'f' }, catalog94));
  }
  assert.throws(() => sanitizePublishedDelta([], catalog94));
  assert.throws(() => sanitizePublishedDelta(Object.create({ opinione_0:'f' }), catalog94));
});

test('accepts only f/c/i and stable identifier shape, no prototype pollution', () => {
  assert.deepEqual({ ...sanitizePublishedDelta({ opinione_0:'f' }, catalog94) }, { opinione_0:'f' });
  assert.equal(Object.getPrototypeOf(sanitizePublishedDelta({ opinione_0:'c' }, catalog94)), null);
  assert.equal(Object.prototype.polluted, undefined);
});

test('does not require historical IDs in current published catalog', () => {
  assert.deepEqual({ ...sanitizeStoredDocument({ [archived]:'i' }) }, { [archived]:'i' });
  assert.throws(() => sanitizeStoredDocument({ [archived]:'invalid' }));
  assert.throws(() => sanitizeStoredDocument(['f']));
});

test('bounds incoming answer count and requires an explicit catalog Set', () => {
  const oversized = Object.fromEntries(Array.from({length:513},(_,i)=>['id_'+i,'f']));
  assert.throws(() => sanitizePublishedDelta(oversized, new Set(Object.keys(oversized))));
  assert.throws(() => sanitizePublishedDelta({opinione_0:'f'}, []));
  assert.throws(() => sanitizePublishedDelta({}, catalog94));
});

test('SQL uses bound JSONB patch and targets private rather than public schema', () => {
  assert.match(SQL.readForUpdate, /WHERE user_id = \$1 FOR UPDATE/);
  assert.match(SQL.upsertPatch, /\$1::uuid/);
  assert.match(SQL.upsertPatch, /\$2::jsonb/);
  assert.match(SQL.upsertPatch, /demos_private\.opinion_answer_maps_v2/);
  assert.equal(SQL.payload({ opinione_0:'c' }), '{"opinione_0":"c"}');
});
