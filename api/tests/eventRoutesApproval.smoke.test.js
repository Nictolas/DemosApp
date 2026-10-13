const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const dbPath = require.resolve(path.join(ROOT, 'config', 'database.js'));
const routePath = require.resolve(path.join(ROOT, 'routes', 'eventi.js'));

function makePool({ approvalSchema = true, ownerId = 'u1' } = {}) {
  const calls = [];
  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    calls.push({ sql: s, params });

    if (s === 'SELECT nome, cognome FROM users WHERE id = $1') {
      return { rows: [{ nome: 'Mario', cognome: 'Rossi' }] };
    }
    if (s.startsWith('INSERT INTO eventi')) {
      if (s.includes('creator_user_id') && !approvalSchema) {
        const error = new Error('approval_status missing'); error.code = '42703'; throw error;
      }
      return { rows: [{ id: 'ev1', approval_status: s.includes('creator_user_id') ? params[16] : undefined }] };
    }
    if (s === 'SELECT * FROM eventi WHERE id = $1') {
      const row = {
        id: 'ev1', creator_user_id: ownerId, approval_status: approvalSchema ? 'APPROVED' : undefined,
        nome_evento: 'Evento', tipologia_evento: 'Altro', giorno_inizio: '2027-01-01',
        comune_evento: 'Pisa', organizzatore: 'Mario Rossi'
      };
      if (!approvalSchema) delete row.approval_status;
      return { rows: [row] };
    }
    if (s.startsWith('UPDATE eventi SET nome_evento=')) {
      return { rows: [{ id: 'ev1', approval_status: approvalSchema ? params[15] : undefined }] };
    }
    if (s.includes("WHERE approval_status = 'PENDING'")) {
      if (!approvalSchema) { const error = new Error('approval missing'); error.code = '42703'; throw error; }
      return { rows: [{ id: 'ev1', nome_evento: 'Evento', approval_status: 'PENDING' }] };
    }
    if (s.startsWith("UPDATE eventi SET approval_status = 'APPROVED'")) {
      if (!approvalSchema) { const error = new Error('approval missing'); error.code = '42703'; throw error; }
      return { rows: [{ id: 'ev1', approval_status: 'APPROVED' }] };
    }
    if (s.startsWith("UPDATE eventi SET approval_status = 'REJECTED'")) {
      return { rows: [{ id: 'ev1', approval_status: 'REJECTED' }] };
    }
    if (s.startsWith('SELECT id, creator_user_id, approval_status FROM eventi')) {
      if (!approvalSchema) { const error = new Error('creator missing'); error.code = '42703'; throw error; }
      return { rows: [{ id: 'ev1', creator_user_id: ownerId, approval_status: 'PENDING' }] };
    }
    if (s === 'SELECT id FROM eventi WHERE id = $1') return { rows: [{ id: 'ev1' }] };
    if (s.startsWith('DELETE FROM eventi')) return { rows: [], rowCount: 1 };
    throw new Error(`Unexpected query: ${s}`);
  };
  return { pool: { query }, calls };
}

async function withEventApp({ user, pool }, fn) {
  const authOriginal = require.cache[authPath];
  const dbOriginal = require.cache[dbPath];
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      verifyToken: (req, res, next) => {
        if (!user) return res.status(401).json({ success: false });
        req.user = user; req.userId = user.id; req.userRole = user.isAdmin ? 'AD' : 'E'; next();
      },
      requireAdmin: (req, res, next) => req.user?.isAdmin ? next() : res.status(403).json({ success: false, error: 'Accesso negato' })
    }
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getPool: () => pool } };
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express(); app.use(express.json()); app.use('/api/eventi', router);
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

const candidate = { id: 'u1', accountType: 'PERSON', isCandidate: true, isPolitician: false, isActivist: false, isAdmin: false };
const ordinary = { id: 'u1', accountType: 'PERSON', isCandidate: false, isPolitician: false, isActivist: false, isAdmin: false };
const admin = { id: 'admin', accountType: 'PERSON', isAdmin: true, isCandidate: false, isPolitician: false, isActivist: false };

async function postEvent(base, body = {}) {
  return fetch(`${base}/api/eventi`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome_evento: 'Evento', tipologia_evento: 'Altro', giorno_inizio: '2027-01-01', ...body })
  });
}

test('ordinary user cannot create an event', async () => {
  const { pool } = makePool();
  await withEventApp({ user: ordinary, pool }, async (base) => {
    const res = await postEvent(base);
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, 'EVENT_CREATION_NOT_ALLOWED');
  });
});

test('recognized candidate creates a pending event request', async () => {
  const { pool, calls } = makePool({ approvalSchema: true });
  await withEventApp({ user: candidate, pool }, async (base) => {
    const res = await postEvent(base);
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.approval.status, 'PENDING');
    const insert = calls.find((call) => call.sql.startsWith('INSERT INTO eventi'));
    assert.equal(insert.params[16], 'PENDING');
    assert.equal(insert.params[17], false);
  });
});

test('without approval schema a non-admin request is blocked instead of being auto-published', async () => {
  const { pool } = makePool({ approvalSchema: false });
  await withEventApp({ user: candidate, pool }, async (base) => {
    const res = await postEvent(base);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'EVENT_APPROVAL_SCHEMA_REQUIRED');
  });
});

test('admin can create a canonical election event already approved', async () => {
  const { pool } = makePool({ approvalSchema: true });
  await withEventApp({ user: admin, pool }, async (base) => {
    const res = await postEvent(base, { tipologia_evento: 'Elezioni', tipo_elezione: 'Europee' });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).approval.status, 'APPROVED');
  });
});

test('non-admin cannot create an election event', async () => {
  const { pool } = makePool();
  await withEventApp({ user: candidate, pool }, async (base) => {
    const res = await postEvent(base, { tipologia_evento: 'Elezioni', tipo_elezione: 'Europee' });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, 'ELECTION_EVENT_ADMIN_ONLY');
  });
});

test('creator substantial edit returns event to pending review', async () => {
  const { pool, calls } = makePool({ approvalSchema: true, ownerId: 'u1' });
  await withEventApp({ user: candidate, pool }, async (base) => {
    const res = await fetch(`${base}/api/eventi/ev1`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ giorno_inizio: '2027-01-02' })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.approval.status, 'PENDING');
    assert.equal(body.approval.pending_staff_review, true);
    const update = calls.find((call) => call.sql.startsWith('UPDATE eventi SET nome_evento='));
    assert.equal(update.params[15], 'PENDING');
    assert.equal(update.params[16], true);
  });
});

test('different recognized user cannot edit another creator event', async () => {
  const { pool } = makePool({ approvalSchema: true, ownerId: 'other' });
  await withEventApp({ user: candidate, pool }, async (base) => {
    const res = await fetch(`${base}/api/eventi/ev1`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ giorno_inizio: '2027-01-02' })
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, 'EVENT_EDIT_NOT_ALLOWED');
  });
});

test('staff can list the pending approval queue', async () => {
  const { pool } = makePool({ approvalSchema: true });
  await withEventApp({ user: admin, pool }, async (base) => {
    const res = await fetch(`${base}/api/eventi/admin/pending`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 1);
    assert.equal(body.data[0].approval_status, 'PENDING');
  });
});

test('staff can approve a pending event', async () => {
  const { pool } = makePool({ approvalSchema: true });
  await withEventApp({ user: admin, pool }, async (base) => {
    const res = await fetch(`${base}/api/eventi/ev1/approve`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.approval_status, 'APPROVED');
  });
});

test('creator can withdraw own event but cannot delete another creator event', async () => {
  {
    const { pool } = makePool({ approvalSchema: true, ownerId: 'u1' });
    await withEventApp({ user: candidate, pool }, async (base) => {
      const res = await fetch(`${base}/api/eventi/ev1`, { method: 'DELETE' });
      assert.equal(res.status, 200);
    });
  }
  {
    const { pool } = makePool({ approvalSchema: true, ownerId: 'other' });
    await withEventApp({ user: candidate, pool }, async (base) => {
      const res = await fetch(`${base}/api/eventi/ev1`, { method: 'DELETE' });
      assert.equal(res.status, 403);
    });
  }
});

test('event mutation routes are explicitly authenticated in source', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(ROOT, 'routes', 'eventi.js'), 'utf8');
  assert.match(source, /router\.put\('\/:id', verifyToken/);
  assert.match(source, /router\.delete\('\/:id', verifyToken/);
  assert.match(source, /router\.post\('\/:id\/approve', verifyToken, requireAdmin/);
});
