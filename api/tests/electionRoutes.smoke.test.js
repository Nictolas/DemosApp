const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));

function makePool() {
  return {
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (s.includes('FROM user_political_territories') || s.includes('FROM user_electoral_unit_memberships')) {
        const err = new Error('territory membership schema missing'); err.code = '42P01'; throw err;
      }
      if (s.includes('FROM users WHERE id = $1') && s.includes('paese_residenza')) {
        return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
      }
      if (s.includes('FROM eventi')) {
        return { rows: [
          { id: 'e-pisa', nome_evento: 'Politiche', tipologia_evento: 'Elezioni', tipo_elezione: 'Politiche_nazionali', paese_evento: 'IT', giorno_inizio: '2027-01-01' },
          { id: 'e-lucca', nome_evento: 'Comunali Lucca', tipologia_evento: 'Elezioni', tipo_elezione: 'Comunali', paese_evento: 'IT', comune_evento: 'Lucca', giorno_inizio: '2027-02-01' }
        ] };
      }
      if (s.includes('FROM unita_elettorale ue')) {
        return { rows: [
          { election_event_id: 'e-pisa', electoral_unit_id: 'unit-pisa', territory_type: 'MUNICIPALITY', territory_code: 'Pisa' },
          { election_event_id: 'e-lucca', electoral_unit_id: 'unit-lucca', territory_type: 'MUNICIPALITY', territory_code: 'Lucca' }
        ] };
      }
      throw new Error(`Unexpected query: ${s} params=${JSON.stringify(params)}`);
    }
  };
}

async function withApp(fn) {
  const original = require.cache[authPath];
  const pool = makePool();
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      pool,
      verifyToken: (req, _res, next) => { req.userId = 'u1'; req.user = { id: 'u1', ruolo: 'E' }; next(); }
    }
  };
  const routePath = require.resolve(path.join(ROOT, 'routes', 'elezioni.js'));
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express(); app.use(express.json()); app.use('/api/elezioni', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
    if (original) require.cache[authPath] = original; else delete require.cache[authPath];
  }
}

test('GET /api/elezioni/prossime legge il modello eventi canonico', async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/elezioni/prossime`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.elezioni[0].id, 'e-pisa');
  });
});

test('GET /api/elezioni/utente filtra per unità elettorale pertinente', async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/elezioni/utente`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.elezioni.map((row) => row.id), ['e-pisa']);
    assert.deepEqual(body.elezioni[0].eligible_electoral_unit_ids, ['unit-pisa']);
  });
});

test('POST legacy /api/elezioni non può più creare righe con createdat=NOW()', async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/elezioni`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titolo: 'Legacy', tipo: 'stato', candidati: [] })
    });
    assert.equal(res.status, 410);
    const body = await res.json();
    assert.equal(body.error, 'LEGACY_ELECTION_WRITE_DISABLED');
  });
});

test('route elezioni non interroga più la tabella legacy elezioni', () => {
  const source = fs.readFileSync(path.join(ROOT, 'routes', 'elezioni.js'), 'utf8');
  assert.doesNotMatch(source, /FROM\s+elezioni\b/i);
  assert.doesNotMatch(source, /INSERT\s+INTO\s+elezioni\b/i);
  assert.doesNotMatch(source, /createdat\s*>\s*NOW/i);
  assert.doesNotMatch(source, /voti_elezioni/i);
});
