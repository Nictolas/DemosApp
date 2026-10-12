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
