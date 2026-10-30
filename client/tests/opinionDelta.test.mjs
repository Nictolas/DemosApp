import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectChangedOpinionAnswers } from '../src/lib/opinionDelta.ts';

test('only changed answers are submitted', () => {
  const q = [
    { id: 'one', userAnswer: 'f' },
    { id: 'two', userAnswer: null },
    { id: 'three', userAnswer: 'c' },
    { id: 'four', userAnswer: 'i' },
  ];
  assert.deepEqual({ ...collectChangedOpinionAnswers(q,
    { one: 'f', two: 'i', three: 'f', four: 'i' }) }, { two: 'i', three: 'f' });
});

test('unmodified/absent answers and invalid values never become writes', () => {
  const q = [{ id: 'one', userAnswer: 'f' }, { id: 'two', userAnswer: null }];
  assert.deepEqual({ ...collectChangedOpinionAnswers(q,
    { one: 'f', two: 'Astenuto', unknown: 'c' }) }, {});
  assert.deepEqual({ ...collectChangedOpinionAnswers(q, {}) }, {});
});

test('only the changed question ID is sent from a stale device', () => {
  const q = [{ id: 'A', userAnswer: 'f' }, { id: 'B', userAnswer: 'i' }];
  assert.deepEqual({ ...collectChangedOpinionAnswers(q, { A: 'c', B: 'i' }) }, { A: 'c' });
});
