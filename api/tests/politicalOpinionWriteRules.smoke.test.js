const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));

async function serveRouter(routeRelativePath, pool, fn) {
  const originalAuth = require.cache[authPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      pool,
      verifyToken: (req, _res, next) => {
        req.userId = 'u1';
        req.user = { id: 'u1', ruolo: 'AD' };
        req.userRole = 'AD';
        next();
      },
      requireAdmin: (_req, _res, next) => next()
    }
  };

  const routePath = require.resolve(path.join(ROOT, ...routeRelativePath));
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
    if (originalAuth) require.cache[authPath] = originalAuth;
    else delete require.cache[authPath];
  }
}

function makeUserAnswersPool() {
  const writes = [];
  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) return { rows: [], rowCount: 0 };
    if (s.includes('political_opinions_consent') && s.includes('AS granted')) {
      return { rows: [{ granted: true }] };
    }
    if (s.includes('information_schema.columns') && s.includes('opinioni_risposte')) {
      return { rows: [{ column_name: 'q1' }] };
    }
    if (s.includes('FROM opinioni_risposte') && s.includes('FOR UPDATE')) {
      return { rows: [] };
    }
    if (s.startsWith('INSERT INTO opinioni_risposte')) {
      writes.push({ sql: s, params });
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected query: ${s}`);
  };
  return {
    writes,
    query,
    async connect() {
      return { query, release() {} };
    }
  };
}

test('salvataggio utente rifiuta NULL/Astenuto e non scrive nel database', async () => {
  for (const invalidValue of [null, 'Astenuto', '']) {
    const pool = makeUserAnswersPool();
    await serveRouter(['routes', 'opinioni', 'user-answers.js'], pool, async (base) => {
      const res = await fetch(`${base}/api/salva`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opinioni: { q1: invalidValue } })
      });
      assert.equal(res.status, 400);
      assert.equal(pool.writes.length, 0);
    });
  }
});

test('salvataggio utente accetta Non lo so e lo salva come i', async () => {
  const pool = makeUserAnswersPool();
  await serveRouter(['routes', 'opinioni', 'user-answers.js'], pool, async (base) => {
    const res = await fetch(`${base}/api/salva`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opinioni: { q1: 'Non lo so' } })
    });
    assert.equal(res.status, 200);
    assert.equal(pool.writes.length, 1);
    assert.deepEqual(pool.writes[0].params, ['u1', 'i']);
  });
});

function makeAdminPool() {
  const writes = [];
  return {
    writes,
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (s === 'SELECT id FROM users WHERE id = $1') return { rows: [{ id: params[0] }] };
      if (s === 'SELECT id FROM opinioni_domande') return { rows: [{ id: 'q1' }] };
      if (s.includes('information_schema.columns') && s.includes("table_name = 'opinioni_risposte'")) {
        return { rows: [{ column_name: 'q1' }] };
      }
      if (s.includes('UPDATE opinioni_risposte') || s.includes('INSERT INTO opinioni_risposte')) {
        writes.push({ sql: s, params });
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected query: ${s}`);
    }
  };
}

test('modifica admin rifiuta la cancellazione di una risposta verso NULL', async () => {
  const pool = makeAdminPool();
  await serveRouter(['routes', 'users', 'profile.js'], pool, async (base) => {
    const res = await fetch(`${base}/api/target/opinioni`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opinioni: { q1: null } })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Risposta non valida');
    assert.equal(pool.writes.length, 0);
  });
});
