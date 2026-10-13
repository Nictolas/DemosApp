const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const dbPath = require.resolve(path.join(ROOT, 'config', 'database.js'));
const routePath = require.resolve(path.join(ROOT, 'routes', 'programma.js'));
const candidate = { id: 'u1', isAdmin: false, capabilities: { isCandidate: true, isPolitician: false } };

function content(text = 'A') {
  return { proposals: [{ text, url: '' }, { text: '', url: '' }, { text: '', url: '' }, { text: '', url: '' }, { text: '', url: '' }] };
}

function makePool({ candidacies = [{ id: 'c1', user_id: 'u1' }], activePrograms = null, snapshots = [] } = {}) {
  const calls = [];
  return {
    calls,
    pool: {
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: s, params });
        if (s.includes('FROM political_candidacies') && s.includes("status = 'ACTIVE'") && !s.includes('JOIN')) {
          if (params.length === 2) return { rows: candidacies.filter((row) => row.id === params[1]) };
          return { rows: candidacies };
        }
        if (s.startsWith('INSERT INTO political_programs')) {
          return { rows: [{ candidacy_id: params[0], user_id: params[1], content: JSON.parse(params[2]), created_at: '2026-10-08', updated_at: '2026-10-08' }] };
        }
        if (s.includes('FROM political_programs pp') && s.includes("pc.status = 'ACTIVE'")) {
          return { rows: activePrograms || [] };
        }
        if (s.includes('FROM mandate_program_snapshots')) return { rows: snapshots };
        if (s.includes('FROM political_programs pp') && s.includes('WHERE pp.candidacy_id = $1')) {
          return { rows: [{ candidacy_id: params[0], user_id: 'u1', content: content('Specifico') }] };
        }
        throw new Error(`Unexpected query: ${s}`);
      }
    }
  };
}

async function withApp(pool, fn) {
  const authOriginal = require.cache[authPath];
  const dbOriginal = require.cache[dbPath];
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: { verifyToken: (req, _res, next) => { req.user = candidate; req.userId = 'u1'; req.userRole = 'C'; next(); } }
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

async function post(base, body = {}) {
  return fetch(`${base}/api/programma`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
}

test('one active candidacy stores program in canonical political_programs', async () => {
  const { pool, calls } = makePool();
  await withApp(pool, async (base) => {
    const res = await post(base, { proposta_1: 'A' });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.canonical, true);
    assert.equal(body.data.candidacy_id, 'c1');
    assert.equal(body.data.proposta1, 'A');
    assert.ok(calls.some((call) => call.sql.startsWith('INSERT INTO political_programs')));
    assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO programmi')), false);
  });
});

test('multiple active candidacies require explicit candidacy_id', async () => {
  const { pool } = makePool({ candidacies: [{ id: 'c1', user_id: 'u1' }, { id: 'c2', user_id: 'u1' }] });
  await withApp(pool, async (base) => {
    const res = await post(base, { proposta_1: 'A' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'PROGRAMMA_CANDIDACY_REQUIRED');
  });
});

test('explicit candidacy_id selects the correct active candidacy', async () => {
  const { pool, calls } = makePool({ candidacies: [{ id: 'c1', user_id: 'u1' }, { id: 'c2', user_id: 'u1' }] });
  await withApp(pool, async (base) => {
    const res = await post(base, { candidacy_id: 'c2', proposta_1: 'B' });
    assert.equal(res.status, 201);
    const insert = calls.find((call) => call.sql.startsWith('INSERT INTO political_programs'));
    assert.equal(insert.params[0], 'c2');
  });
});

test('user-scoped GET returns active canonical program and exposes candidacy context', async () => {
  const active = [{ candidacy_id: 'c1', user_id: 'u1', content: content('Attivo'), created_at: '2026-10-08', updated_at: '2026-10-08' }];
  const { pool } = makePool({ activePrograms: active });
  await withApp(pool, async (base) => {
    const res = await fetch(`${base}/api/programma/u1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.canonical, true);
    assert.equal(body.data.proposta1, 'Attivo');
    assert.equal(body.data.candidacy_id, 'c1');
  });
});

test('after losing candidacy canonical GET does not resurrect legacy user program', async () => {
  const { pool, calls } = makePool({ activePrograms: [], snapshots: [] });
  await withApp(pool, async (base) => {
    const res = await fetch(`${base}/api/programma/u1`);
    assert.equal(res.status, 404);
    assert.equal(calls.some((call) => /FROM programmi WHERE utente_id/.test(call.sql)), false);
  });
});

test('winner without new candidacy exposes frozen mandate snapshot', async () => {
  const snapshots = [{ mandate_id: 'm1', candidacy_id: 'c-old', user_id: 'u1', content: content('Congelato'), frozen_at: '2027-01-01' }];
  const { pool } = makePool({ activePrograms: [], snapshots });
  await withApp(pool, async (base) => {
    const res = await fetch(`${base}/api/programma/u1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.frozen, true);
    assert.equal(body.data.proposta1, 'Congelato');
    assert.equal(body.data.mandate_id, 'm1');
  });
});

test('candidacy endpoint reads an explicit political program', async () => {
  const { pool } = makePool();
  await withApp(pool, async (base) => {
    const res = await fetch(`${base}/api/programma/candidacy/c1`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.proposta1, 'Specifico');
  });
});
