const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const catalogPath = require.resolve(path.join(ROOT, 'services', 'opinionCatalog.js'));
const matchingPath = require.resolve(path.join(ROOT, 'services', 'politicalMatchingService.js'));

function makePool({ complete = true, withEmptyProfiles = false } = {}) {
  const questionIds = ['q1', 'q2', 'q3', 'q4'];
  const userRow = { user_id: 'u1', q1: 'f', q2: 'c', q3: 'i', q4: complete ? 'f' : null };
  const reps = {
    p1: { user_id: 'p1', q1: 'f', q2: 'c', q3: 'i', q4: 'f' },
    p2: { user_id: 'p2', q1: 'f', q2: 'f', q3: 'i', q4: 'f' },
    p3: { user_id: 'p3', q1: 'c', q2: 'f', q3: 'f', q4: 'c' },
    p4: { user_id: 'p4', q1: 'f', q2: null, q3: null, q4: null },
    p5: { user_id: 'p5', q1: 'c', q2: 'c', q3: 'i', q4: 'f' }
  };
  if (withEmptyProfiles) {
    // Un profilo privo di opinioni non deve occupare uno dei quattro slot.
    for (const id of ['p2', 'p4']) {
      reps[id] = { user_id: id, q1: null, q2: null, q3: null, q4: null };
    }
  }
  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
      if (s.includes('FROM user_political_territories') || s.includes('FROM user_electoral_unit_memberships')) {
        const err = new Error('territory membership schema missing'); err.code = '42P01'; throw err;
      }
    if (s.startsWith('SELECT id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza FROM users')) {
      return { rows: [{ id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
    }
    if (s.includes('FROM political_mandates')) { const err = new Error('capability schema missing'); err.code = '42P01'; throw err; }
    if (s.includes('FROM political_selections ps')) { const err = new Error('political selections schema missing'); err.code = '42P01'; throw err; }
    if (s.includes('FROM users u') && s.includes("u.ruolo = 'P' OR u.ruolo = 'CP'")) {
      assert.match(s, /u\.status = 'a'/);
      return { rows: Object.keys(reps).map((id) => ({ id, nome: id.toUpperCase(), cognome: 'Test', ruolo: 'P', status: 'a', avatar_config: null, grado_elezione: params[0] })) };
    }
    if (s.includes('SELECT id FROM opinioni_domande')) return { rows: questionIds.map((id) => ({ id })) };
    if (s.includes('FROM opinioni_risposte') && s.includes('user_id = ANY($1)')) {
      return { rows: params[0].map(String).map((id) => id === 'u1' ? userRow : reps[id]).filter(Boolean) };
    }
    if (s.includes('SELECT rappresentante_europeo')) return { rows: [{ rappresentante_europeo: null, rappresentante_camera: null, rappresentante_senato: null, rappresentante_regionale: null, rappresentante_comune: null }] };
    throw new Error(`Unexpected query: ${s}`);
  };
  return { query };
}

async function withRoute({ routeFile, mount, pool, fn }) {
  const original = require.cache[authPath];
  const previousCatalog = require.cache[catalogPath];
  const previousMatching = require.cache[matchingPath];
  // Only the test fixture uses q1..q4. In production this function reads
  // all canonical grade IDs from the versioned 94-opinion catalog.
  require.cache[catalogPath] = { id:catalogPath,filename:catalogPath,loaded:true,
    exports:{getOpinionIdsForGrade:()=>['q1','q2','q3','q4']} };
  delete require.cache[matchingPath];
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      pool,
      verifyToken: (req, _res, next) => { req.userId = 'u1'; req.user = { id: 'u1', ruolo: 'E' }; req.userRole = 'E'; next(); },
      requireAdmin: (_req, _res, next) => next()
    }
  };
  const routePath = require.resolve(path.join(ROOT, 'routes', routeFile));
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express(); app.use(express.json()); app.use(mount, router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[routePath];
    if (original) require.cache[authPath] = original; else delete require.cache[authPath];
    if(previousCatalog)require.cache[catalogPath]=previousCatalog;else delete require.cache[catalogPath];
    if(previousMatching)require.cache[matchingPath]=previousMatching;else delete require.cache[matchingPath];
  }
}

test('HTTP rappresentanti: utente completo riceve top 4 con compatibilità e copertura', async () => {
  await withRoute({ routeFile: 'rappresentanti.js', mount: '/api/rappresentanti', pool: makePool({ complete: true }), fn: async (base) => {
    const res = await fetch(`${base}/api/rappresentanti/disponibili?grado_elezione=E`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const rows = body.data.candidati;
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((x) => x.id), ['p1', 'p2', 'p5', 'p4']);
    assert.deepEqual(rows.map((x) => x.matching_score), [10, 6, 6, 3]);
    assert.equal(rows[0].compatibilita_percentuale, 83.3);
    assert.equal(rows[3].copertura_posizioni, 1);
    assert.equal(body.data.matching.userComplete, true);
  }});
});

test('HTTP rappresentanti: esclude profili senza opinioni prima del top 4, mantenendo i discordanti', async () => {
  await withRoute({ routeFile: 'rappresentanti.js', mount: '/api/rappresentanti', pool: makePool({ complete: true, withEmptyProfiles: true }), fn: async (base) => {
    const res = await fetch(`${base}/api/rappresentanti/disponibili?grado_elezione=E`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const rows = body.data.candidati;
    assert.deepEqual(rows.map((x) => x.id), ['p1', 'p5', 'p3']);
    assert.ok(rows.every((x) => x.copertura_posizioni > 0));
    assert.ok(rows[2].matching_score < 0, 'anche chi ha opinioni discordanti deve restare visibile');
    assert.equal(body.data.matching.userComplete, true);
  }});
});

test('HTTP rappresentanti: utente incompleto riceve zero suggerimenti e metadata gate', async () => {
  await withRoute({ routeFile: 'rappresentanti.js', mount: '/api/rappresentanti', pool: makePool({ complete: false }), fn: async (base) => {
    const res = await fetch(`${base}/api/rappresentanti/disponibili?grado_elezione=E`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data.candidati, []);
    assert.equal(body.data.matching.userComplete, false);
    assert.equal(body.data.matching.answeredOpinions, 3);
    assert.equal(body.data.matching.missingOpinions, 1);
  }});
});

test('eleggibilità rappresentanti: backend esclude profili non politici e inattivi', () => {
  const source = fs.readFileSync(path.join(ROOT, 'services', 'politicalEligibilityService.js'), 'utf8');

  assert.match(
    source,
    /FROM political_mandates[\s\S]*?AND u\.status = 'a'[\s\S]*?AND u\.ruolo IN \('P', 'CP'\)/,
    'il modello canonico deve accettare solo politici attivi'
  );
  assert.match(
    source,
    /async function listEligibleRepresentativesLegacy[\s\S]*?WHERE \(u\.ruolo = 'P' OR u\.ruolo = 'CP'\)[\s\S]*?AND u\.status = 'a'[\s\S]*?AND u\.grado_elezione = \$1/,
    'il fallback legacy deve accettare solo politici attivi del grado richiesto'
  );
});
