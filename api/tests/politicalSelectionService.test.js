const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveSelectionContract,
  setPoliticalSelection,
  loadPoliticalSelections,
  loadSupporterUserIds,
} = require('../services/politicalSelectionService');

const migration = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '20261009_political_selections.sql'),
  'utf8',
);

test('political selection migration is jurisdiction-neutral and private by default', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS political_selections/);
  assert.match(migration, /selection_kind TEXT NOT NULL/);
  assert.match(migration, /jurisdiction_id TEXT NOT NULL/);
  assert.match(migration, /political_office_id TEXT NOT NULL/);
  assert.match(migration, /selected_user_id UUID NOT NULL/);
  assert.match(migration, /selected_candidacy_id UUID NULL/);
  assert.match(migration, /selected_mandate_id UUID NULL/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /CREATE POLICY/i);
});

test('selection contract resolves Italy and USA through the same service', () => {
  assert.equal(resolveSelectionContract({ kind: 'representative', officeValue: 'CAMERA' })?.officeId, 'it.camera');
  assert.equal(resolveSelectionContract({ kind: 'candidate', officeValue: 'us.house', adapterId: 'us' })?.jurisdictionId, 'us');
  assert.equal(resolveSelectionContract({ kind: 'other', officeValue: 'it.camera' }), null);
});

test('setPoliticalSelection writes canonical row and Italian compatibility projection', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (String(sql).includes('FOR UPDATE')) return { rows: [{ id: params[0] }], rowCount: 1 };
      if (String(sql).includes(' AS granted')) return { rows: [{ id: params[0], granted: true }], rowCount: 1 };
      if (/UPDATE users/.test(sql)) return { rowCount: 1, rows: [{ id: params[1] }] };
      return { rowCount: 1, rows: [] };
    },
  };
  const result = await setPoliticalSelection(db, {
    userId: '11111111-1111-1111-1111-111111111111',
    kind: 'representative',
    officeValue: 'it.camera',
    selectedUserId: '22222222-2222-2222-2222-222222222222',
    source: 'matching',
  });
  assert.equal(result.canonical.available, true);
  assert.equal(result.legacy.field, 'rappresentante_camera');
  assert.ok(queries.some(({ sql }) => /INSERT INTO political_selections/.test(sql)));
  assert.ok(queries.some(({ sql }) => /SET rappresentante_camera = \$1/.test(sql)));
});

test('USA selection writes only canonical storage and never invents a legacy column', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (String(sql).includes('FOR UPDATE')) return { rows: [{ id: params[0] }], rowCount: 1 };
      if (String(sql).includes(' AS granted')) return { rows: [{ id: params[0], granted: true }], rowCount: 1 };
      return { rowCount: 1, rows: [] };
    },
  };
  const result = await setPoliticalSelection(db, {
    userId: '11111111-1111-1111-1111-111111111111',
    kind: 'candidate',
    officeValue: 'us.house',
    adapterId: 'us',
    selectedUserId: '22222222-2222-2222-2222-222222222222',
  });
  assert.equal(result.canonical.available, true);
  assert.equal(result.legacy.available, false);
  assert.equal(queries.filter(({ sql }) => /UPDATE users/.test(sql)).length, 0);
});

test('missing canonical table falls back to legacy projection on writes', async () => {
  const db = {
    async query(sql, params) {
      if (String(sql).includes('FOR UPDATE')) return { rows: [{ id: params[0] }], rowCount: 1 };
      if (String(sql).includes(' AS granted')) return { rows: [{ id: params[0], granted: true }], rowCount: 1 };
      if (/political_selections/.test(sql)) {
        const error = new Error('missing');
        error.code = '42P01';
        throw error;
      }
      if (/UPDATE users/.test(sql)) return { rowCount: 1, rows: [{ id: params[1] }] };
      return { rowCount: 1, rows: [] };
    },
  };
  const result = await setPoliticalSelection(db, {
    userId: 'u1',
    kind: 'candidate',
    officeValue: 'C',
    selectedUserId: 'p1',
  });
  assert.equal(result.canonical.available, false);
  assert.equal(result.legacy.field, 'candidato_camera');
});

test('canonical reads are authoritative and do not fall back merely because they are empty', async () => {
  const db = { async query() { return { rows: [] }; } };
  const state = await loadPoliticalSelections(db, { userId: 'u1', kind: 'candidate', adapterId: 'it' });
  assert.equal(state.source, 'CANONICAL');
  assert.equal(state.strict, true);
  assert.deepEqual(state.selections, []);
});

test('supporter lookup uses canonical selection relation when available', async () => {
  const db = {
    async query(sql) {
      assert.match(sql, /FROM political_selections ps/);
      return { rows: [{ id: 'u1' }, { id: 'u2' }] };
    },
  };
  const supporters = await loadSupporterUserIds(db, {
    selectedUserId: 'p1',
    kind: 'representative',
    officeId: 'it.camera',
  });
  assert.deepEqual(supporters.userIds, ['u1', 'u2']);
  assert.equal(supporters.source, 'CANONICAL');
});

test('adapter-scoped canonical reads use the full adapter office set, including offices without legacy columns', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      return { rows: [] };
    },
  };
  const state = await loadPoliticalSelections(db, { userId: 'u1', adapterId: 'us' });
  assert.equal(state.source, 'CANONICAL');
  assert.equal(state.strict, true);
  const officeIds = calls[0].params[1];
  assert.ok(officeIds.includes('us.president'));
  assert.ok(officeIds.includes('us.house'));
  assert.ok(officeIds.includes('us.senate'));
  assert.equal(officeIds.some((id) => id.startsWith('it.')), false);
  assert.match(calls[0].sql, /ps\.political_office_id = ANY\(\$2::text\[\]\)/);
});