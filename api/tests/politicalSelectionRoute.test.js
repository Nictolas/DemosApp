const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const civicIdentityPath = require.resolve(path.join(ROOT, 'middleware', 'civicIdentity.js'));

function makePool() {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ sql: s, params });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) return { rows: [], rowCount: 0 };
      if (s.startsWith('DELETE FROM political_selections')) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected client query: ${s}`);
    },
    release() {},
  };
  return { calls, connect: async () => client, query: async () => { throw new Error('Unexpected pool query'); } };
}

async function withProfile(pool, fn) {
  const original = require.cache[authPath];
  const originalCivicIdentity = require.cache[civicIdentityPath];
  require.cache[civicIdentityPath] = {
    id: civicIdentityPath, filename: civicIdentityPath, loaded: true,
    exports: { requireVerifiedCivicIdentity: (_req, _res, next) => next() }
  };
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      pool,
      verifyToken: (req, _res, next) => { req.userId = 'u1'; req.user = { id: 'u1', ruolo: 'E' }; next(); },
      requireAdmin: (_req, _res, next) => next(),
    },
  };
  const routePath = require.resolve(path.join(ROOT, 'routes', 'users', 'profile.js'));
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express();
  app.use(express.json());
  app.use('/api/users', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
    if (original) require.cache[authPath] = original; else delete require.cache[authPath];
    if (originalCivicIdentity) require.cache[civicIdentityPath] = originalCivicIdentity;
    else delete require.cache[civicIdentityPath];
  }
}

test('generic endpoint can remove a US House selection without any Italian legacy column', async () => {
  const pool = makePool();
  await withProfile(pool, async (base) => {
    const res = await fetch(`${base}/api/users/u1/political-selection`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'candidate', officeId: 'us.house', selectedUserId: null }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.selection, {
      kind: 'candidate',
      jurisdictionId: 'us',
      officeId: 'us.house',
      selectedUserId: null,
      storage: 'CANONICAL',
    });
  });
  const sql = pool.calls.map((call) => call.sql).join('\n');
  assert.match(sql, /DELETE FROM political_selections/);
  assert.doesNotMatch(sql, /candidato_|rappresentante_|user_representatives|UPDATE users/);
});


test('unreleased provincial choices are rejected before territory queries or persistence', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  const pool = makePool();
  try {
    await withProfile(pool, async (base) => {
      for (const officeId of ['it.provincial.trento', 'it.provincial.bolzano']) {
        for (const kind of ['representative', 'candidate']) {
          const res = await fetch(`${base}/api/users/u1/political-selection`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind, officeId, selectedUserId: 'synthetic-subject' }),
          });
          assert.equal(res.status, 409);
          assert.equal((await res.json()).error, 'PROVINCIAL_SELECTION_NOT_RELEASED');
        }
      }
    });
    assert.deepEqual(pool.calls, [], 'no SQL is executed for denied provincial writes');
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});

test('unreleased provincial choices can be removed but never create a users column', async () => {
  const prior = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  const pool = makePool();
  try {
    await withProfile(pool, async (base) => {
      const res = await fetch(`${base}/api/users/u1/political-selection`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'representative',
          officeId: 'it.provincial.trento',
          selectedUserId: null,
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.selection.officeId, 'it.provincial.trento');
      assert.equal(data.selection.storage, 'CANONICAL');
    });
    const statements = pool.calls.map((call) => call.sql).join('\n');
    assert.match(statements, /DELETE FROM political_selections/);
    assert.doesNotMatch(statements, /UPDATE users|user_representatives|rappresentante_provinciale/);
  } finally {
    if (prior === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = prior;
  }
});

test('provincial selection cannot bypass six-opinion completion by spoofing Podio source', async () => {
  const previous = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
  const calls = [];
  const pool = {
    connect: async () => { throw new Error('Incomplete provincial opinions must not reach storage'); },
    async query(sql) {
      calls.push(String(sql));
      if (String(sql).includes('FROM opinioni_risposte')) return { rows: [] };
      throw new Error('Unexpected SQL in provincial completion test');
    },
  };
  try {
    await withProfile(pool, async (base) => {
      for (const source of ['podio', 'matching']) {
        const res = await fetch(`${base}/api/users/u1/political-selection`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'representative', officeId: 'it.provincial.trento',
            selectedUserId: 'synthetic-person', source,
          }),
        });
        assert.equal(res.status, 409);
        const body = await res.json();
        assert.equal(body.error, 'OPINIONI_INCOMPLETE');
        assert.equal(body.data.totalOpinions, 6);
        assert.equal(body.data.missingOpinions, 6);
      }
    });
    assert.equal(calls.length, 2, 'only one personal-answers read per request');
  } finally {
    if (previous === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = previous;
  }
});

test('provincial selection read only exposes the authenticated account and remains closed before GO', async () => {
  const previous = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql: String(sql), params });
      if (!String(sql).includes('FROM political_selections ps')) throw new Error('Unexpected query');
      return { rows: [{
        user_id: 'u1', selection_kind: 'representative', jurisdiction_id: 'it',
        political_office_id: 'it.provincial.trento', selected_user_id: 'official-1',
        source: 'matching', context: {},
      }] };
    },
  };
  try {
    delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    await withProfile(pool, async (base) => {
      const url = '/api/users/u1/provincial-selection?kind=representative&officeId=it.provincial.trento';
      const unreleased = await fetch(base + url);
      assert.equal(unreleased.status, 409);
      assert.equal((await unreleased.json()).error, 'PROVINCIAL_SELECTION_NOT_RELEASED');
      assert.equal(queries.length, 0);

      process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
      const other = await fetch(base + url.replace('/u1/', '/another-user/'));
      assert.equal(other.status, 403);
      assert.equal(queries.length, 0);

      const invalidOffice = await fetch(base + url.replace('it.provincial.trento', 'it.camera'));
      assert.equal(invalidOffice.status, 400);
      assert.equal(queries.length, 0);

      const current = await fetch(base + url);
      assert.equal(current.status, 200);
      assert.equal(current.headers.get('cache-control'), 'no-store');
      assert.deepEqual((await current.json()).selection, {
        kind: 'representative', officeId: 'it.provincial.trento',
        selectedUserId: 'official-1',
      });
      assert.equal(queries.length, 1);
      assert.equal(queries[0].params[0], 'u1');
      assert.equal(queries[0].params[1], 'representative');
      assert.ok(queries[0].sql.includes('ps.user_id = $1'));
    });
  } finally {
    if (previous === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = previous;
  }
});
