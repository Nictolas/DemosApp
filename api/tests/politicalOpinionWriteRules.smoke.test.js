const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const civicIdentityPath = require.resolve(path.join(ROOT, 'middleware', 'civicIdentity.js'));

async function serveRouter(routeRelativePath, pool, fn) {
  const originalAuth = require.cache[authPath];
  const originalCivicIdentity = require.cache[civicIdentityPath];
  require.cache[civicIdentityPath] = {
    id: civicIdentityPath,
    filename: civicIdentityPath,
    loaded: true,
    exports: { requireVerifiedCivicIdentity: (_req, _res, next) => next() }
  };
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
    if (originalCivicIdentity) require.cache[civicIdentityPath] = originalCivicIdentity;
    else delete require.cache[civicIdentityPath];
  }
}

function makeUserAnswersPool({ granted = true } = {}) {
  const writes = [];
  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) return { rows: [], rowCount: 0 };
    if (s === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (s.includes('political_opinions_consent') && s.includes('AS granted')) {
      return { rows: [{ granted }] };
    }
    if (s.includes('information_schema.columns')) {
      throw new Error('Saving an opinion must not read SQL schema metadata');
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

test('salvataggio utente senza consenso politico attivo è fail-closed e non scrive', async () => {
  const pool = makeUserAnswersPool({ granted: false });
  await serveRouter(['routes', 'opinioni', 'user-answers.js'], pool, async (base) => {
    const res = await fetch(`${base}/api/salva`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opinioni: { energia_nucleare: 'Favorevole' } })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.consent_required, true);
    assert.equal(pool.writes.length, 0);
  });
});

test('salvataggio utente rifiuta NULL/Astenuto e non scrive nel database', async () => {
  for (const invalidValue of [null, 'Astenuto', '']) {
    const pool = makeUserAnswersPool();
    await serveRouter(['routes', 'opinioni', 'user-answers.js'], pool, async (base) => {
      const res = await fetch(`${base}/api/salva`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opinioni: { energia_nucleare: invalidValue } })
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
      body: JSON.stringify({ opinioni: { energia_nucleare: 'Non lo so' } })
    });
    assert.equal(res.status, 200);
    assert.equal(pool.writes.length, 1);
    assert.deepEqual(pool.writes[0].params, ['u1', 'i']);
  });
});

function makeAdminPool({ granted = true, revokedBeforeWrite = false } = {}) {
  const writes = [];
  const sequence = [];
  const pool = {
    writes,
    sequence,
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN','COMMIT','ROLLBACK'].includes(s)) {
        sequence.push(s);
        return {rows:[],rowCount:0};
      }
      if (s === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
        sequence.push('USER_LOCK');
        return {rows:[{id:params[0]}],rowCount:1};
      }
      if (s.includes('AS granted') && s.includes('FROM users u')) {
        sequence.push('CONSENT_AFTER_LOCK');
        return {rows:[{granted:granted && !revokedBeforeWrite}]};
      }
      if (s.includes('FROM users u') && s.includes('political_opinions_consent')) {
        return { rows: [{ id: params[0], political_opinions_consent: granted }] };
      }
      if (s === 'SELECT id FROM opinioni_domande') return { rows: [{ id: 'energia_nucleare' }] };
      if (s.includes('information_schema.columns') && s.includes("table_name = 'opinioni_risposte'")) {
        return { rows: [{ column_name: 'energia_nucleare' }] };
      }
      if (s.startsWith('SELECT user_id FROM opinioni_risposte')) {
        return {rows:[],rowCount:0};
      }
      if (s.includes('UPDATE opinioni_risposte') || s.includes('INSERT INTO opinioni_risposte')) {
        writes.push({ sql: s, params });
        sequence.push('WRITE_OPINION');
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected query: ${s}`);
    },
    async connect() {
      return {query:pool.query.bind(pool),release(){}};
    }
  };
  return pool;
}

test('modifica admin senza consenso politico del soggetto è fail-closed e non scrive', async () => {
  const pool = makeAdminPool({ granted: false });
  await serveRouter(['routes', 'users', 'profile.js'], pool, async (base) => {
    const res = await fetch(`${base}/api/target/opinioni`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opinioni: { energia_nucleare: 'Favorevole' } })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.consent_required, true);
    assert.equal(pool.writes.length, 0);
  });
});

test('modifica admin ricontrolla consenso dopo il lock e non scrive dopo revoca concorrente', async () => {
  const pool = makeAdminPool({granted:true,revokedBeforeWrite:true});
  await serveRouter(['routes','users','profile.js'],pool,async(base)=>{
    const res=await fetch(`${base}/api/target/opinioni`,{
      method:'PUT',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({opinioni:{energia_nucleare:'Favorevole'}})
    });
    assert.equal(res.status,403);
    assert.equal((await res.json()).consent_required,true);
    assert.deepEqual(pool.writes,[]);
    assert.deepEqual(pool.sequence,['BEGIN','USER_LOCK','CONSENT_AFTER_LOCK','ROLLBACK']);
  });
});

test('modifica admin con consenso stabile scrive solo dopo il lock e commit', async () => {
  const pool=makeAdminPool();
  await serveRouter(['routes','users','profile.js'],pool,async(base)=>{
    const res=await fetch(`${base}/api/target/opinioni`,{
      method:'PUT',headers:{'content-type':'application/json'},
      body:JSON.stringify({opinioni:{energia_nucleare:'Non lo so'}})
    });
    assert.equal(res.status,200);
    assert.deepEqual(pool.writes[0].params,['target','i']);
    assert.deepEqual(pool.sequence,['BEGIN','USER_LOCK','CONSENT_AFTER_LOCK','WRITE_OPINION','COMMIT']);
  });
});

test('modifica admin rifiuta la cancellazione di una risposta verso NULL', async () => {
  const pool = makeAdminPool();
  await serveRouter(['routes', 'users', 'profile.js'], pool, async (base) => {
    const res = await fetch(`${base}/api/target/opinioni`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opinioni: { energia_nucleare: null } })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Risposta non valida');
    assert.equal(pool.writes.length, 0);
  });
});
