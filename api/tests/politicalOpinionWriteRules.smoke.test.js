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
    if (s.startsWith('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (s.includes('political_opinions_consent') && s.includes('AS granted')) {
      return { rows: [{ granted }] };
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

test('salvataggio utente senza consenso politico attivo è fail-closed e non scrive', async () => {
  const pool = makeUserAnswersPool({ granted: false });
  await serveRouter(['routes', 'opinioni', 'user-answers.js'], pool, async (base) => {
    const res = await fetch(`${base}/api/salva`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opinioni: { q1: 'Favorevole' } })
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

function makeAdminPool({
  granted = true, grantedAfterLock = granted,
  userExistsAfterLock = true, failOnInsert = false
} = {}) {
  const writes = [];
  const sequence = [];
  let checkedUnderLock = false;
  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) {
      sequence.push(s);
      return { rows: [], rowCount: 0 };
    }
    if (s.startsWith('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
      sequence.push('LOCK_USERS_ROW');
      checkedUnderLock = true;
      return userExistsAfterLock
        ? { rows: [{ id: params[0] }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (s.includes('FROM users u') && s.includes('political_opinions_consent')) {
      sequence.push(checkedUnderLock ? 'CONSENT_RECHECK' : 'CONSENT_PREFLIGHT');
      return { rows: [{ id: params[0],
        political_opinions_consent: checkedUnderLock ? grantedAfterLock : granted,
        granted: checkedUnderLock ? grantedAfterLock : granted }] };
    }
    if (s === 'SELECT id FROM opinioni_domande')
      return { rows: [{ id: 'q1' }] };
    if (s.includes('information_schema.columns') &&
        s.includes("table_name = 'opinioni_risposte'")) {
      return { rows: [{ column_name: 'q1' }] };
    }
    if (s.startsWith('SELECT fonti_opinioni FROM opinioni_risposte')) {
      sequence.push('SOURCE_READ');
      return { rows: [] };
    }
    if (s.startsWith('SELECT user_id FROM opinioni_risposte WHERE user_id = $1 FOR UPDATE')) {
      sequence.push('READ_EXISTING');
      return { rows: [] };
    }
    if (s.startsWith('INSERT INTO opinioni_risposte') ||
        s.startsWith('UPDATE opinioni_risposte')) {
      sequence.push('WRITE_OPINIONS');
      if(failOnInsert)throw new Error('synthetic DB write failure');
      writes.push({ sql: s, params });
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected query: ${s}`);
  };
  return {
    writes,sequence,query,
    async connect(){return {query,release(){sequence.push('RELEASE');}};}
  };
}

test('modifica admin senza consenso politico del soggetto è fail-closed e non scrive', async () => {
  const pool = makeAdminPool({ granted: false });
  await serveRouter(['routes', 'users', 'profile.js'], pool, async (base) => {
    const res = await fetch(`${base}/api/target/opinioni`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opinioni: { q1: 'Favorevole' } })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.consent_required, true);
    assert.equal(pool.writes.length, 0);
  });
});

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

test('modifica admin con consenso scrive solo dopo lock e seconda lettura', async () => {
  const pool=makeAdminPool();
  await serveRouter(['routes','users','profile.js'],pool,async(base)=>{
    const response=await fetch(base+'/api/target/opinioni',{
      method:'PUT',headers:{'content-type':'application/json'},
      body:JSON.stringify({opinioni:{q1:'Non lo so'},fonti:{q1:'Synthetic public source'}})
    });
    assert.equal(response.status,200);
    assert.equal((await response.json()).updatedFields,1);
  });
  const pos=(item)=>pool.sequence.indexOf(item);
  assert.ok(pos('CONSENT_PREFLIGHT')<pos('BEGIN'));
  assert.ok(pos('BEGIN')<pos('LOCK_USERS_ROW'));
  assert.ok(pos('LOCK_USERS_ROW')<pos('CONSENT_RECHECK'));
  assert.ok(pos('CONSENT_RECHECK')<pos('SOURCE_READ'));
  assert.ok(pos('SOURCE_READ')<pos('READ_EXISTING'));
  assert.ok(pos('READ_EXISTING')<pos('WRITE_OPINIONS'));
  assert.ok(pos('WRITE_OPINIONS')<pos('COMMIT'));
  assert.ok(pos('COMMIT')<pos('RELEASE'));
  assert.equal(pool.writes.length,1);
});

test('modifica admin rifiuta la scrittura se il consenso è revocato fra preflight e lock', async()=>{
  const pool=makeAdminPool({granted:true,grantedAfterLock:false});
  await serveRouter(['routes','users','profile.js'],pool,async(base)=>{
    const response=await fetch(base+'/api/target/opinioni',{
      method:'PUT',headers:{'content-type':'application/json'},
      body:JSON.stringify({opinioni:{q1:'f'}})
    });
    assert.equal(response.status,403);
    assert.equal((await response.json()).consent_required,true);
  });
  assert.equal(pool.writes.length,0);
  assert.deepEqual(pool.sequence,[
    'CONSENT_PREFLIGHT','BEGIN','LOCK_USERS_ROW','CONSENT_RECHECK','ROLLBACK','RELEASE'
  ]);
});

test('modifica admin non ricrea risposte quando il soggetto sparisce prima del lock',async()=>{
  const pool=makeAdminPool({granted:true,userExistsAfterLock:false});
  await serveRouter(['routes','users','profile.js'],pool,async(base)=>{
    const response=await fetch(base+'/api/target/opinioni',{
      method:'PUT',headers:{'content-type':'application/json'},
      body:JSON.stringify({opinioni:{q1:'f'}})
    });
    assert.equal(response.status,404);
    assert.equal((await response.json()).error,'Utente non trovato');
  });
  assert.equal(pool.writes.length,0);
  assert.deepEqual(pool.sequence,[
    'CONSENT_PREFLIGHT','BEGIN','LOCK_USERS_ROW','ROLLBACK','RELEASE'
  ]);
});

test('modifica admin esegue rollback e release se una scrittura DB fallisce',async()=>{
  const pool=makeAdminPool({failOnInsert:true});
  await serveRouter(['routes','users','profile.js'],pool,async(base)=>{
    const response=await fetch(base+'/api/target/opinioni',{
      method:'PUT',headers:{'content-type':'application/json'},
      body:JSON.stringify({opinioni:{q1:'c'}})
    });
    assert.equal(response.status,500);
  });
  assert.equal(pool.writes.length,0);
  assert.ok(pool.sequence.indexOf('WRITE_OPINIONS')<pool.sequence.indexOf('ROLLBACK'));
  assert.equal(pool.sequence.at(-1),'RELEASE');
});
