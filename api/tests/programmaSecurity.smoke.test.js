const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const dbPath = require.resolve(path.join(ROOT, 'config', 'database.js'));
const routePath = require.resolve(path.join(ROOT, 'routes', 'programma.js'));

function makePool() {
  const calls = [];
  return {
    calls,
    pool: {
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: s, params });
        if (s.includes('FROM political_candidacies')) {
          const error = new Error('canonical program schema missing');
          error.code = '42P01';
          throw error;
        }
        if (s.startsWith('INSERT INTO programmi')) return { rows: [{ utente_id: params[0] }] };
        throw new Error(`Unexpected query: ${s}`);
      }
    }
  };
}

async function withApp({ user, pool }, fn) {
  const authOriginal = require.cache[authPath];
  const dbOriginal = require.cache[dbPath];
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      verifyToken: (req, res, next) => {
        if (!user) return res.status(401).json({ success: false, error: 'Token richiesto' });
        req.user = user; req.userId = user.id; req.userRole = user.isAdmin ? 'AD' : 'E'; next();
      }
    }
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getPool: () => pool } };
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express(); app.use(express.json()); app.use('/api/programma', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
    if (authOriginal) require.cache[authPath] = authOriginal; else delete require.cache[authPath];
    if (dbOriginal) require.cache[dbPath] = dbOriginal; else delete require.cache[dbPath];
  }
}

const candidate = { id: 'u1', isAdmin: false, capabilities: { isCandidate: true, isPolitician: false } };
const ordinary = { id: 'u1', isAdmin: false, capabilities: { isCandidate: false, isPolitician: false } };

async function post(base, body = {}) {
  return fetch(`${base}/api/programma`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('programma POST requires authentication', async () => {
  const { pool } = makePool();
  await withApp({ user: null, pool }, async (base) => assert.equal((await post(base)).status, 401));
});

test('ordinary user cannot create a political program', async () => {
  const { pool } = makePool();
  await withApp({ user: ordinary, pool }, async (base) => {
    const res = await post(base, { proposta_1: 'X' });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, 'PROGRAMMA_POLITICAL_PROFILE_REQUIRED');
  });
});

test('candidate cannot overwrite another user program by forging utente_id', async () => {
  const { pool } = makePool();
  await withApp({ user: candidate, pool }, async (base) => {
    const res = await post(base, { utente_id: 'victim', proposta_1: 'X' });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, 'PROGRAMMA_OWNERSHIP_REQUIRED');
  });
});

test('candidate writes only own program from authenticated identity', async () => {
  const { pool, calls } = makePool();
  await withApp({ user: candidate, pool }, async (base) => {
    const res = await post(base, { proposta_1: 'X' });
    assert.equal(res.status, 201);
    const insert = calls.find((call) => call.sql.startsWith('INSERT INTO programmi'));
    assert.equal(insert.params[0], 'u1');
  });
});

test('programma route imports isEnabled instead of referencing an undefined symbol', () => {
  const source = fs.readFileSync(path.join(ROOT, 'routes', 'programma.js'), 'utf8');
  assert.match(source, /invalidateProgrammaCaches, isEnabled/);
  assert.match(source, /router\.post\('\/', verifyToken/);
});
