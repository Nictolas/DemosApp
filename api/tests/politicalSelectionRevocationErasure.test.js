'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clearPersonalPoliticalSelections,
} = require('../services/politicalConsentService');

const SELECTED_ID = '00000000-0000-4000-8000-000000000301';
const SUBJECT_ID = '00000000-0000-4000-8000-000000000302';

function stubStore({ canonical = true, legacy = true, fields = ['rappresentante_camera', 'candidato_comune'] } = {}) {
  const statements = [];
  const present = new Map([
    ['political_selections', canonical ? ['user_id', 'selected_user_id'] : []],
    ['user_representatives', legacy ? ['user_id', 'rappresentante_camera', 'candidato_comune'] : []],
  ]);
  let updates = 0;
  const db = {
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      statements.push({ sql: s, params });
      if (s.includes('FROM information_schema.columns') && s.includes('column_name = ANY')) {
        if (s.includes('table_name = $1')) {
          const available = present.get(params[0]) || [];
          return { rows: (params[1] || []).filter(x => available.includes(x)).map(column_name => ({ column_name })) };
        }
        if (s.includes("table_name = 'users'")) {
          return { rows: (params[0] || []).filter(name => fields.includes(name)).map(column_name => ({ column_name })) };
        }
      }
      if (s.startsWith('DELETE FROM "political_selections"')) {
        assert.deepEqual(params, [SELECTED_ID]);
        assert.match(s, /"user_id"::text = \$1/);
        assert.doesNotMatch(s, /selected_user_id/);
        return { rowCount: 2 };
      }
      if (s.startsWith('DELETE FROM "user_representatives"')) {
        assert.deepEqual(params, [SELECTED_ID]);
        return { rowCount: 1 };
      }
      if (s.startsWith('UPDATE users SET')) {
        updates++;
        assert.match(s, /"rappresentante_camera" = NULL/);
        assert.match(s, /"candidato_comune" = NULL/);
        assert.doesNotMatch(s, /nome|cognome|ruolo|mandato|email/);
        assert.deepEqual(params, [SELECTED_ID]);
        return { rowCount: 1 };
      }
      throw new Error('Unexpected SQL in erasure test: ' + s);
    },
  };
  return { db, statements, get updates() { return updates; } };
}

test('revocation deletes canonical+legacy private selections and clears only personal user fields', async () => {
  const storage = stubStore();
  const removed = await clearPersonalPoliticalSelections(storage.db, SELECTED_ID);
  assert.equal(removed.totalDeleted, 3);
  assert.deepEqual(removed.deletedByTable, { political_selections: 2, user_representatives: 1 });
  assert.equal(removed.legacySelectionsCleared, 2);
  assert.equal(storage.updates, 1);
});

test('unknown canonical/legacy relations and missing projection columns are schema-safe', async () => {
  const storage = stubStore({ canonical: false, legacy: false, fields: [] });
  const removed = await clearPersonalPoliticalSelections(storage.db, SELECTED_ID);
  assert.deepEqual(removed, { totalDeleted: 0, deletedByTable: {}, legacySelectionsCleared: 0 });
  assert.equal(storage.updates, 0);
  assert.ok(!storage.statements.some(x => x.sql.startsWith('DELETE FROM')));
});

test('personal erasure never deletes rows where the user is only the selected public subject', async () => {
  const storage = stubStore({ legacy: false, fields: [] });
  await clearPersonalPoliticalSelections(storage.db, SELECTED_ID);
  const canonicalDelete = storage.statements.find(x => x.sql.startsWith('DELETE FROM "political_selections"'));
  assert.ok(canonicalDelete);
  assert.match(canonicalDelete.sql, /"user_id"::text = \$1/);
  assert.doesNotMatch(canonicalDelete.sql, /"selected_user_id"::text = \$1/);
  assert.notEqual(SELECTED_ID, SUBJECT_ID);
});

test('database failure is not swallowed, so the surrounding revoke transaction can roll back', async () => {
  const db = {
    async query(sql) {
      if (String(sql).includes('information_schema.columns')) return { rows: [{ column_name: 'user_id' }] };
      const err = new Error('synthetic-delete-refused');
      err.code = '23503';
      throw err;
    }
  };
  await assert.rejects(clearPersonalPoliticalSelections(db, SELECTED_ID),
    error => error.code === '23503');
});
