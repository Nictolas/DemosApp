const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const civicIdentityPath = require.resolve(path.join(ROOT, 'middleware', 'civicIdentity.js'));

function makePool({ complete = true, canonicalBlocked = false } = {}) {
  const questionIds = ['q1', 'q2', 'q3', 'q4'];
  const userRow = { user_id: 'u1', q1: 'f', q2: 'c', q3: 'i', q4: complete ? 'f' : null };
  const subjectRows = {
    p1: { user_id: 'p1', q1: 'f', q2: 'c', q3: 'i', q4: 'f' },
    p2: { user_id: 'p2', q1: 'f', q2: 'f', q3: 'i', q4: 'f' },
    p3: { user_id: 'p3', q1: 'c', q2: 'f', q3: 'f', q4: 'c' },
    p4: { user_id: 'p4', q1: 'f', q2: null, q3: null, q4: null },
    p5: { user_id: 'p5', q1: 'c', q2: 'c', q3: 'i', q4: 'f' }
  };

  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
      if (s.includes('FROM user_political_territories') || s.includes('FROM user_electoral_unit_memberships')) {
        const err = new Error('territory membership schema missing'); err.code = '42P01'; throw err;
      }
    if (s.startsWith('SELECT id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza FROM users')) {
      return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
    }
    if (s.includes('FROM political_candidacies')) {
      if (!canonicalBlocked) { const err = new Error('capability schema missing'); err.code = '42P01'; throw err; }
      return { rows: [{ id: 'p1', nome: 'P1', cognome: 'Test', ruolo: 'C', status: 'a', avatar_config: null, election_event_id: 'e1', electoral_unit_id: 'unit-lucca', jurisdiction: { level: 'E' }, grado_candidatura: 'E' }] };
    }
    if (s.includes('FROM unita_elettorale ue')) {
      return { rows: [{ election_event_id: 'e1', electoral_unit_id: 'unit-lucca', territory_type: 'MUNICIPALITY', territory_code: 'Lucca' }] };
    }
    if (s.includes('FROM users') && s.includes("ruolo IN ('C', 'CP')") && s.includes('grado_candidatura = $1')) {
      return { rows: Object.keys(subjectRows).map((id) => ({ id, nome: id.toUpperCase(), cognome: 'Test', ruolo: 'C', status: 'a', avatar_config: null, grado_candidatura: params[0] })) };
    }
    if (s.includes('SELECT id FROM opinioni_domande')) return { rows: questionIds.map((id) => ({ id })) };
    if (s.includes('FROM opinioni_risposte') && s.includes('user_id = ANY($1)')) {
      const ids = params[0].map(String);
      return { rows: ids.map((id) => id === 'u1' ? userRow : subjectRows[id]).filter(Boolean) };
    }
    if (s.startsWith('INSERT INTO political_selections') || s.startsWith('DELETE FROM political_selections')) { const err = new Error('political selections schema missing'); err.code = '42P01'; throw err; }
    if (s.includes("to_regclass('public.user_representatives')")) return { rows: [{ available: false }], rowCount: 1 };
    if (s.startsWith('UPDATE users SET candidato_')) return { rows: [{ id: 'u1' }], rowCount: 1 };
    if (s.startsWith('INSERT INTO user_representatives')) return { rows: [], rowCount: 1 };
    if (s.startsWith('SELECT * FROM users WHERE id = ')) return { rows: [{ id: params[0] }], rowCount: 1 };
    throw new Error(`Unexpected query: ${s}`);
  };

  const client = {
    query: async (sql, params = []) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [], rowCount: 0 };
      return query(sql, params);
    },
    release: () => {},
  };
  return { query, connect: async () => client };
}

async function withCandidateApp(pool, fn) {
  const original = require.cache[authPath];
  const originalCivicIdentity = require.cache[civicIdentityPath];
  require.cache[civicIdentityPath] = {
    id: civicIdentityPath, filename: civicIdentityPath, loaded: true,
    exports: { requireVerifiedCivicIdentity: (_req, _res, next) => next() }
  };
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      pool,
      verifyToken: (req, res, next) => { if (req.get('x-synthetic-deny') === '1') return res.status(401).json({success:false}); req.userId = 'u1'; req.user = { id: 'u1', ruolo: 'E' }; next(); }
    }
  };
  const routePath = require.resolve(path.join(ROOT, 'routes', 'candidati.js'));
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express();
  app.use(express.json());
  app.use('/api/candidati', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
    if (original) require.cache[authPath] = original; else delete require.cache[authPath];
    if (originalCivicIdentity) require.cache[civicIdentityPath] = originalCivicIdentity;
    else delete require.cache[civicIdentityPath];
  }
}

test('HTTP candidati europei: alias usa lo stesso matching canonico/fallback', async () => {
  await withCandidateApp(makePool({ complete: true }), async (base) => {
    const res = await fetch(`${base}/api/candidati/europei`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 4);
    assert.deepEqual(body.data.map((x) => x.id), ['p1', 'p2', 'p5', 'p4']);
    assert.equal(body.eligibility.source, 'LEGACY');
  });
});

test('HTTP candidati: utente completo riceve esattamente top 4 ordinati per score', async () => {
  await withCandidateApp(makePool({ complete: true }), async (base) => {
    const res = await fetch(`${base}/api/candidati/disponibili?grado_candidatura=E`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 4);
    assert.deepEqual(body.data.map((x) => x.id), ['p1', 'p2', 'p5', 'p4']);
    assert.deepEqual(body.data.map((x) => x.matching_score), [10, 6, 6, 3]);
    assert.equal(body.data[0].compatibilita_percentuale, 83.3);
    assert.equal(body.data[3].copertura_posizioni, 1);
    assert.equal(body.data[3].copertura_totale, 4);
  });
});

test('HTTP candidati: utente incompleto non riceve suggerimenti', async () => {
  await withCandidateApp(makePool({ complete: false }), async (base) => {
    const res = await fetch(`${base}/api/candidati/disponibili?grado_candidatura=E`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 0);
    assert.deepEqual(body.data, []);
  });
});

test('HTTP selezione candidato: gate backend rifiuta utente incompleto con 409', async () => {
  await withCandidateApp(makePool({ complete: false }), async (base) => {
    const res = await fetch(`${base}/api/candidati/seleziona-candidato`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campo: 'test_europeo', candidatoId: 'p1' })
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, 'OPINIONI_INCOMPLETE');
    assert.equal(body.data.totalOpinions, 4);
    assert.equal(body.data.answeredOpinions, 3);
  });
});

test('HTTP selezione candidato: utente completo può selezionare', async () => {
  await withCandidateApp(makePool({ complete: true }), async (base) => {
    const res = await fetch(`${base}/api/candidati/seleziona-candidato`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campo: 'test_europeo', candidatoId: 'p1' })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });
});

test('HTTP selezione candidato: candidato fuori circoscrizione viene bloccato dal backend', async () => {
  await withCandidateApp(makePool({ complete: true, canonicalBlocked: true }), async (base) => {
    const res = await fetch(`${base}/api/candidati/seleziona-candidato`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campo: 'test_europeo', candidatoId: 'p1' })
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'CANDIDATO_NON_VOTABILE');
    assert.equal(body.data.strict, true);
  });
});

test('candidate routes never allow browser or shared cache, including auth and validation failures', async () => {
  await withCandidateApp(makePool(), async (base) => {
    for (const [url, options, expected] of [
      ['/api/candidati/europei', {}, 200],
      ['/api/candidati/disponibili', {}, 400],
      ['/api/candidati/disponibili?grado_candidatura=E', { headers: { 'x-synthetic-deny': '1' } }, 401],
    ]) {
      const res = await fetch(base + url, options);
      assert.equal(res.status, expected);
      assert.match(res.headers.get('cache-control') || '', /(?:^|,\s*)private(?:,|$)/);
      assert.match(res.headers.get('cache-control') || '', /(?:^|,\s*)no-store(?:,|$)/);
    }
  });
});
