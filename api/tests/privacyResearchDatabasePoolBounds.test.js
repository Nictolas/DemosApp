const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseResearchPoolMax,
  RESEARCH_POOL_DEFAULT_MAX,
  RESEARCH_POOL_HARD_MAX,
  RESEARCH_IDLE_TIMEOUT_MS,
  RESEARCH_CONNECTION_TIMEOUT_MS,
  RESEARCH_QUERY_TIMEOUT_MS,
  RESEARCH_STATEMENT_TIMEOUT_MS
} = require('../config/researchDatabase');

test('Research pool concurrency defaults to a small bounded value', () => {
  assert.equal(RESEARCH_POOL_DEFAULT_MAX, 5);
  assert.equal(RESEARCH_POOL_HARD_MAX, 10);
  assert.equal(parseResearchPoolMax(undefined), 5);
  assert.equal(parseResearchPoolMax(''), 5);
  assert.equal(parseResearchPoolMax('1'), 1);
  assert.equal(parseResearchPoolMax('10'), 10);
});

test('Research pool concurrency configuration fails closed outside the contract', () => {
  for (const value of ['0', '11', '-1', '1.5', '5x', ' 5', '05', '999999999999999999999']) {
    assert.throws(
      () => parseResearchPoolMax(value),
      /integer between 1 and 10/
    );
  }
  assert.throws(() => parseResearchPoolMax(5), /integer between 1 and 10/);
});

test('Research database timeout budgets remain tightly bounded', () => {
  assert.equal(RESEARCH_IDLE_TIMEOUT_MS, 15000);
  assert.equal(RESEARCH_CONNECTION_TIMEOUT_MS, 5000);
  assert.equal(RESEARCH_QUERY_TIMEOUT_MS, 10000);
  assert.equal(RESEARCH_STATEMENT_TIMEOUT_MS, 10000);
  assert.ok(RESEARCH_CONNECTION_TIMEOUT_MS < RESEARCH_QUERY_TIMEOUT_MS);
  assert.ok(RESEARCH_QUERY_TIMEOUT_MS <= RESEARCH_IDLE_TIMEOUT_MS);
});
