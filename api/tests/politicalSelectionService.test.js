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
test('provincial write is denied without release GO, but removal works canonically', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  const calls = [];
  const db = { async query(sql) { calls.push(String(sql)); return { rowCount: 1, rows: [] }; } };
  try {
    for (const officeId of ['it.provincial.trento', 'it.provincial.bolzano']) {
      await assert.rejects(
        () => setPoliticalSelection(db, {
          userId: 'resident', kind: 'representative', officeValue: officeId,
          selectedUserId: 'subject',
        }),
        { code: 'PROVINCIAL_SELECTION_NOT_RELEASED' },
      );
    }
    assert.deepEqual(calls, [], 'denied writes never access storage');
    const removed = await setPoliticalSelection(db, {
      userId: 'resident', kind: 'representative',
      officeValue: 'it.provincial.trento', selectedUserId: null,
    });
    assert.equal(removed.canonical.removed, true);
    assert.equal(removed.legacy.available, false);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^DELETE FROM political_selections/);
    assert.doesNotMatch(calls.join('\\n'), /UPDATE users|user_representatives/);
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});

test('provincial representative is persisted canonically without a users column', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
  try {
  const queries = [];
  const db = { async query(sql, params) { queries.push({sql: String(sql), params}); return {rowCount: 1, rows: []}; } };
  for (const officeId of ['it.provincial.trento', 'it.provincial.bolzano']) {
    const r = await setPoliticalSelection(db, {
      userId: '11111111-1111-1111-1111-111111111111',
      kind: 'representative',
      officeValue: officeId,
      selectedUserId: '22222222-2222-2222-2222-222222222222',
    });
    assert.equal(r.canonical.written, true);
    assert.equal(r.legacy.available, false);
    assert.equal(r.contract.officeId, officeId);
  }
  const canonicalWrites = queries.filter(({sql}) => /INSERT INTO political_selections/.test(sql));
  assert.equal(canonicalWrites.length, 2);
  assert.deepEqual(canonicalWrites.map(({params}) => params[3]), ['it.provincial.trento', 'it.provincial.bolzano']);
  assert.equal(queries.some(({sql}) => /UPDATE users|user_representatives/.test(sql)), false);
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});

test('combined supporter totals deduplicate provincial and regional selections', async () => {
  const calls = [];
  const db = { async query(sql, params) {
    calls.push({ sql: String(sql), params });
    assert.match(String(sql), /SELECT DISTINCT u\.id::text AS id/);
    assert.match(String(sql), /FROM political_selections ps/);
    assert.doesNotMatch(String(sql), /ps\.political_office_id =/);
    // Deliberately duplicate a synthetic voter to prove the service contract
    // also protects consumers if a future adapter stops deduplicating SQL rows.
    return { rows: [{ id: 'voter-a' }, { id: 'voter-a' }, { id: 'voter-b' }] };
  }};
  const result = await loadSupporterUserIds(db, {
    selectedUserId: 'councillor', kind: 'representative'
  });
  assert.equal(result.source, 'CANONICAL');
  assert.deepEqual(result.userIds, ['voter-a', 'voter-b']);
  assert.deepEqual(calls[0].params, ['councillor', 'representative']);
  assert.equal(calls.length, 1);
});

test('combined legacy supporter fallback also returns unique voter identities', async () => {
  let calls = 0;
  const db = { async query(sql) {
    calls++;
    if (String(sql).includes('FROM political_selections ps')) {
      const error = new Error('Synthetic canonical relation unavailable');
      error.code = '42P01';
      throw error;
    }
    assert.match(String(sql), /SELECT DISTINCT u\.id::text AS id/);
    assert.match(String(sql), /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
    assert.doesNotMatch(String(sql), /AND u\.political_opinions_consent IS TRUE/);
    assert.match(String(sql), /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
    return { rows: [{ id: 'voter-a' }, { id: 'voter-a' }, { id: 'voter-b' }] };
  }};
  const result = await loadSupporterUserIds(db, {
    selectedUserId: 'councillor', kind: 'representative'
  });
  assert.equal(result.source, 'LEGACY');
  assert.deepEqual(result.userIds, ['voter-a', 'voter-b']);
  assert.equal(calls, 2);
});

test('provincial supporter notifications fail closed before GO without any SQL', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'false';
  try {
    const db = { async query() { throw new Error('unreleased office must not reach SQL'); } };
    for (const officeId of ['it.provincial.trento', 'it.provincial.bolzano']) {
      const result = await loadSupporterUserIds(db, {
        selectedUserId: 'councillor', kind: 'representative', officeId
      });
      assert.equal(result.strict, true);
      assert.deepEqual(result.userIds, []);
    }
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});

test('combined notifications exclude unreleased offices and revoked consents in the same SELECT', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'false';
  try {
    let queries = 0;
    const db = { async query(sql, params) {
      queries += 1;
      assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
      assert.doesNotMatch(sql, /AND u\.political_opinions_consent IS TRUE/);
      assert.match(sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
      assert.match(sql, /ps\.political_office_id NOT IN \('it\.provincial\.trento', 'it\.provincial\.bolzano'\)/);
      assert.deepEqual(params, ['councillor', 'representative']);
      return { rows: [{ id: 'active-consenting-voter' }] };
    }};
    const result = await loadSupporterUserIds(db, {
      selectedUserId: 'councillor', kind: 'representative'
    });
    assert.equal(queries, 1);
    assert.deepEqual(result.userIds, ['active-consenting-voter']);
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});

test('released provincial supporter lookup enforces consent without fallback to legacy tables', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
  try {
    let queries = 0;
    const db = { async query(sql, params) {
      queries += 1;
      assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
      assert.doesNotMatch(sql, /AND u\.political_opinions_consent IS TRUE/);
      assert.match(sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
      assert.match(sql, /ps\.political_office_id = \$3/);
      assert.doesNotMatch(sql, /ps\.political_office_id NOT IN/);
      assert.deepEqual(params, ['councillor', 'representative', 'it.provincial.trento']);
      const error = new Error('synthetic political_selections schema absent');
      error.code = '42P01';
      throw error;
    }};
    const result = await loadSupporterUserIds(db, {
      selectedUserId: 'councillor',
      kind: 'representative',
      officeId: 'it.provincial.trento'
    });
    assert.equal(queries, 1);
    assert.equal(result.strict, true);
    assert.deepEqual(result.userIds, []);
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});

test('supporter audience honors current consent even when legacy user flag is false', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  try {
    process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
    for (const canonicalAvailable of [true, false]) {
      const calls = [];
      const db = { async query(sql) {
        const statement = String(sql);
        calls.push(statement);
        if (!canonicalAvailable && statement.includes('FROM political_selections ps')) {
          const error = new Error('Synthetic canonical table missing');
          error.code = '42P01';
          throw error;
        }
        assert.match(statement, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
        assert.match(statement, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
        assert.doesNotMatch(statement, /AND u\.political_opinions_consent IS TRUE/);
        // Simulates current user_consents=true, users=false: a redundant
        // legacy-only predicate would exclude this otherwise eligible voter.
        return { rows: [{ id: 'consented-in-new-table' }] };
      }};
      const result = await loadSupporterUserIds(db, {
        selectedUserId: 'councillor', kind: 'representative',
        ...(canonicalAvailable ? { officeId: 'it.provincial.trento' } : {}),
      });
      assert.deepEqual(result.userIds, ['consented-in-new-table']);
      assert.equal(result.source, canonicalAvailable ? 'CANONICAL' : 'LEGACY');
      assert.equal(calls.length, canonicalAvailable ? 1 : 2);
    }
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});
