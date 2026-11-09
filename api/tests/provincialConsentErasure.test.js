'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONSENT_SCOPED_TABLES,
  cleanupConsentScopedPoliticalData,
} = require('../services/politicalConsentService');

test('consent withdrawal removes owner canonical political choices, with no new users columns', async () => {
  assert.ok(CONSENT_SCOPED_TABLES.includes('political_selections'));
  const queries = [];
  const db = { async query(sql, params = []) {
    const statement = String(sql).replace(/\s+/g, ' ').trim();
    queries.push({ statement, params });
    if (statement.includes('FROM information_schema.columns response_cols')) {
      return { rows: [] };
    }
    if (statement.startsWith('SELECT EXISTS')) {
      return { rows: [{ exists: false }] };
    }
    if (statement.startsWith('SELECT column_name FROM information_schema.columns')) {
      if (params[0] === 'political_selections') {
        return { rows: [{ column_name: 'user_id' }] };
      }
      return { rows: [] }; // All other tables absent in this synthetic fixture.
    }
    if (statement.startsWith('DELETE FROM "political_selections"')) {
      assert.equal(statement, 'DELETE FROM "political_selections" WHERE "user_id"::text = $1');
      assert.deepEqual(params, ['owner-1'], 'do not delete other accounts');
      return { rows: [], rowCount: 2 }; // Candidate and representative slots.
    }
    throw new Error('Unexpected SQL in political consent erasure: ' + statement);
  } };

  const result = await cleanupConsentScopedPoliticalData(db, 'owner-1');
  assert.deepEqual(result.deletedByTable, { political_selections: 2 });
  assert.equal(result.totalDeleted, 2);
  assert.equal(result.legacyOpinionColumnsCleared, 0);
  assert.equal(result.proposalLinksCleared, 0);
  assert.equal(queries.filter((entry) => entry.statement.startsWith('DELETE FROM')).length, 1);
  assert.equal(queries.filter((entry) => entry.statement.startsWith('UPDATE users')).length, 0);
});

test('consent withdrawal tolerates absent canonical selection schema without unscoped deletion', async () => {
  let deletes = 0;
  const db = { async query(sql) {
    const statement = String(sql);
    if (statement.includes('FROM information_schema.columns response_cols')) return { rows: [] };
    if (statement.includes('SELECT EXISTS')) return { rows: [{ exists: false }] };
    if (statement.includes('FROM information_schema.columns')) return { rows: [] };
    if (statement.includes('DELETE FROM')) deletes++;
    throw new Error('Unexpected SQL: ' + statement);
  } };
  const result = await cleanupConsentScopedPoliticalData(db, 'owner-1');
  assert.equal(result.totalDeleted, 0);
  assert.equal(deletes, 0);
});
