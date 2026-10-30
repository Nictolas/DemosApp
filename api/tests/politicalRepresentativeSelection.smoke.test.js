const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const civicIdentityPath = require.resolve(path.join(ROOT, 'middleware', 'civicIdentity.js'));
const catalogPath = require.resolve(path.join(ROOT,'services','opinionCatalog.js'));
const matchingPath = require.resolve(path.join(ROOT,'services','politicalMatchingService.js'));

function makePool({ complete, canonicalBlocked = false }) {
  const ids = ['q1', 'q2'];
  const userRow = { user_id: 'u1', q1: 'f', q2: complete ? 'i' : null };
  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
      if (s.includes('FROM user_political_territories') || s.includes('FROM user_electoral_unit_memberships')) {
        const err = new Error('territory membership schema missing'); err.code = '42P01'; throw err;
      }
    if (s.includes('SELECT id FROM opinioni_domande')) return { rows: ids.map((id) => ({ id })) };
    if (s.includes('FROM opinioni_risposte') && s.includes('user_id = ANY($1)')) return { rows: [userRow] };
    if (s.startsWith('SELECT id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza FROM users')) {
      return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
    }
    if (s.includes('FROM political_mandates')) {
      if (!canonicalBlocked) { const err = new Error('capability schema missing'); err.code = '42P01'; throw err; }
      return { rows: [{ id: 'p1', nome: 'P1', cognome: 'Test', ruolo: 'P', status: 'a', avatar_config: null, grado_elezione: 'R', jurisdiction: { region: 'LA', level: 'R' } }] };
    }
    if (s.includes("u.ruolo = 'P' OR u.ruolo = 'CP'")) {
      return { rows: [{ id: 'p1', nome: 'P1', cognome: 'Test', ruolo: 'P', status: 'a', avatar_config: null, grado_elezione: params[0] }] };
    }
    throw new Error(`Unexpected pool.query: ${s}`);
  };
  const client = {
    query: async (sql, params = []) => {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) return { rows: [], rowCount: 0 };
      if (s.startsWith('INSERT INTO political_selections') || s.startsWith('DELETE FROM political_selections')) {
        const err = new Error('political selections schema missing'); err.code = '42P01'; throw err;
      }
      if (s.includes("to_regclass('public.user_representatives')")) return { rows: [{ available: false }], rowCount: 1 };
      if (/^UPDATE users SET rappresentante_(europeo|camera|senato|regionale|comune)/.test(s)) return { rows: [{ id: 'u1' }], rowCount: 1 };
      if (s.startsWith('INSERT INTO user_representatives')) return { rows: [], rowCount: 1 };
      if (s.startsWith('SELECT * FROM users WHERE id = $1')) return { rows: [{ id: params[0] }], rowCount: 1 };
      throw new Error(`Unexpected client.query: ${s}`);
    },
    release: () => {}
  };
  return { query, connect: async () => client };
}

async function withProfile(pool, fn) {
  const original = require.cache[authPath];
  const originalCivicIdentity = require.cache[civicIdentityPath];
  const previousCatalog = require.cache[catalogPath];
  const previousMatching = require.cache[matchingPath];
  require.cache[catalogPath] = {id:catalogPath,filename:catalogPath,loaded:true,
    exports:{getOpinionIdsForGrade:()=>['q1','q2']} };
  delete require.cache[matchingPath];
  require.cache[civicIdentityPath] = {
    id: civicIdentityPath, filename: civicIdentityPath, loaded: true,
    exports: { requireVerifiedCivicIdentity: (_req, _res, next) => next() }
  };
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      pool,
      verifyToken: (req, _res, next) => { req.userId = 'u1'; req.user = { id: 'u1', ruolo: 'E' }; next(); },
      requireAdmin: (_req, _res, next) => next()
    }
  };
  const routePath = require.resolve(path.join(ROOT, 'routes', 'users', 'profile.js'));
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express(); app.use(express.json()); app.use('/api/users', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
    if (original) require.cache[authPath] = original; else delete require.cache[authPath];
    if (originalCivicIdentity) require.cache[civicIdentityPath] = originalCivicIdentity;
    else delete require.cache[civicIdentityPath];
    if(previousCatalog)require.cache[catalogPath]=previousCatalog;else delete require.cache[catalogPath];
    if(previousMatching)require.cache[matchingPath]=previousMatching;else delete require.cache[matchingPath];
  }
}

async function selectRepresentative(base, campo = 'rappresentante_europeo', source = 'matching') {
  return fetch(`${base}/api/users/u1/seleziona-rappresentante`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ campo, rappresentanteId: 'p1', source })
  });
}

test('selezione rappresentante: utente incompleto viene bloccato dal backend', async () => {
  await withProfile(makePool({ complete: false }), async (base) => {
    const res = await selectRepresentative(base);
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, 'OPINIONI_INCOMPLETE');
    assert.equal(body.data.totalOpinions, 2);
    assert.equal(body.data.answeredOpinions, 1);
  });
});

test('selezione rappresentante: utente completo può procedere', async () => {
  await withProfile(makePool({ complete: true }), async (base) => {
    const res = await selectRepresentative(base);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });
});

test('Podio: scelta diretta funziona su tutte e cinque le classifiche senza richiedere il matching completo', async () => {
  const fields = [
    'rappresentante_europeo',
    'rappresentante_camera',
    'rappresentante_senato',
    'rappresentante_regionale',
    'rappresentante_comune'
  ];

  await withProfile(makePool({ complete: false }), async (base) => {
    for (const campo of fields) {
      const res = await selectRepresentative(base, campo, 'podio');
      assert.equal(res.status, 200, campo);
      const body = await res.json();
      assert.equal(body.success, true, campo);
    }
  });
});

async function selectRegionalRepresentative(base) {
  return fetch(`${base}/api/users/u1/seleziona-rappresentante`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ campo: 'rappresentante_regionale', rappresentanteId: 'p1' })
  });
}

test('selezione rappresentante: rappresentante regionale di altra regione viene bloccato', async () => {
  await withProfile(makePool({ complete: true, canonicalBlocked: true }), async (base) => {
    const res = await selectRegionalRepresentative(base);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'RAPPRESENTANTE_NON_SELEZIONABILE');
    assert.equal(body.data.strict, true);
  });
});
