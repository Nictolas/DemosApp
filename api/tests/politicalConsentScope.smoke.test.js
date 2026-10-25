const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const ROOT = path.resolve(__dirname, '..');
const {
  CONSENT_SCOPED_TABLES,
  getPoliticalConsentState,
  cleanupConsentScopedPoliticalData
} = require(path.join(ROOT, 'services', 'politicalConsentService.js'));

function normalize(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

test('perimetro consenso include dati politici generati dall utente ma non voti istituzionali importati', () => {
  for (const table of [
    'opinioni_risposte',
    'voti_capo_stato',
    'voti_referendum_abrogativi',
    'voti_iniziative_popolari',
    'voti_opinioni_proposte',
    'voti_primo_ministro',
    'consenso_governo',
    'consenso_capo_stato'
  ]) {
    assert.equal(CONSENT_SCOPED_TABLES.includes(table), true, table);
  }

  for (const institutionalTable of ['voti_camera', 'voti_senato', 'parlamento_voti']) {
    assert.equal(CONSENT_SCOPED_TABLES.includes(institutionalTable), false, institutionalTable);
  }
});

test('cleanup revoca è schema-aware e cancella tutte le superfici utente presenti', async () => {
  const presentColumns = new Map([
    ['opinioni_risposte', 'user_id'],
    ['voti_capo_stato', 'userid'],
    ['voti_referendum_abrogativi', 'userid'],
    ['consenso_governo', 'userId']
  ]);
  const deleteCounts = new Map([
    ['opinioni_risposte', 3],
    ['voti_capo_stato', 1],
    ['voti_referendum_abrogativi', 2],
    ['consenso_governo', 1]
  ]);
  const deletedTables = [];

  const db = {
    async query(sql, params = []) {
      const s = normalize(sql);
      if (s.includes('FROM information_schema.columns') && s.includes('column_name = ANY')) {
        const table = params[0];
        const column = presentColumns.get(table);
        return { rows: column ? [{ column_name: column }] : [], rowCount: column ? 1 : 0 };
      }
      if (s.startsWith('DELETE FROM "')) {
        const match = s.match(/^DELETE FROM "([^"]+)"/);
        const table = match?.[1];
        deletedTables.push(table);
        return { rows: [], rowCount: deleteCounts.get(table) || 0 };
      }
      if (s.includes('FROM information_schema.columns response_cols')) {
        return { rows: [{ column_name: 'legacy_opinion' }], rowCount: 1 };
      }
      if (s.startsWith('UPDATE users SET "legacy_opinion" = NULL')) {
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('SELECT EXISTS') && params[0] === 'users' && params[1] === 'opinione_proposta_id') {
        return { rows: [{ exists: false }], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${s}`);
    }
  };

  const result = await cleanupConsentScopedPoliticalData(db, 'u1');
  assert.equal(result.totalDeleted, 7);
  assert.deepEqual(result.deletedByTable, {
    opinioni_risposte: 3,
    voti_capo_stato: 1,
    voti_referendum_abrogativi: 2,
    consenso_governo: 1
  });
  assert.equal(result.legacyOpinionColumnsCleared, 1);
  assert.equal(result.proposalLinksCleared, 0);
  assert.deepEqual(new Set(deletedTables), new Set(presentColumns.keys()));
  assert.equal(deletedTables.includes('voti_camera'), false);
});

test('lettura consenso usa user_consents con fallback users e fallisce chiusa', async () => {
  const granted = await getPoliticalConsentState({
    async query() { return { rows: [{ id: 'u1', granted: true }] }; }
  }, 'u1');
  assert.deepEqual(granted, { exists: true, granted: true });

  const denied = await getPoliticalConsentState({
    async query() { return { rows: [{ id: 'u1', granted: null }] }; }
  }, 'u1');
  assert.deepEqual(denied, { exists: true, granted: false });

  const missing = await getPoliticalConsentState({
    async query() { return { rows: [] }; }
  }, 'missing');
  assert.deepEqual(missing, { exists: false, granted: false });
});

test('tutte le scritture cittadino che esprimono preferenze politiche richiedono il guard condiviso', () => {
  const expectations = [
    ['routes/amnistia.js', "router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent"],
    ['routes/capo-stato.js', "}, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {"],
    ['routes/capo-stato.js', "router.post('/consenso', noStoreHeadOfStateConsent, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent"],
    ['routes/grazia.js', "}, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {"],
    ['routes/iniziative-popolari.js', "router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent"],
    ['routes/referendum.js', "router.post('/abrogativi/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent"],
    ['routes/opinioni-proposte.js', "router.post('/', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent"],
    ['routes/opinioni-proposte.js', "}, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {"],
    ['routes/governo.js', "router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent"],
    ['routes/governo.js', "router.post('/consenso', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent"]
  ];

  for (const [relative, expected] of expectations) {
    const source = fs.readFileSync(path.join(ROOT, ...relative.split('/')), 'utf8');
    assert.equal(source.includes(expected), true, `${relative}: ${expected}`);
    assert.equal(source.includes("require('../middleware/politicalConsent')"), true, `${relative}: import consent guard`);
    assert.equal(source.includes("require('../middleware/civicIdentity')"), true, `${relative}: import civic identity guard`);
  }
});

test('rimozione volontaria dei voti resta possibile anche senza consenso attivo', () => {
  const amnistia = fs.readFileSync(path.join(ROOT, 'routes', 'amnistia.js'), 'utf8');
  const iniziative = fs.readFileSync(path.join(ROOT, 'routes', 'iniziative-popolari.js'), 'utf8');
  const referendum = fs.readFileSync(path.join(ROOT, 'routes', 'referendum.js'), 'utf8');
  const proposte = fs.readFileSync(path.join(ROOT, 'routes', 'opinioni-proposte.js'), 'utf8');

  assert.match(amnistia, /router\.delete\('\/vota', verifyToken,/);
  assert.match(iniziative, /router\.delete\('\/vota', verifyToken,/);
  assert.match(referendum, /router\.delete\('\/abrogativi\/vota', verifyToken,/);
  assert.match(proposte, /router\.delete\('\/:id\/vota', verifyToken,/);
});

async function serveGuard(granted, fn) {
  const configPath = require.resolve(path.join(ROOT, 'config', 'database.js'));
  const servicePath = require.resolve(path.join(ROOT, 'services', 'politicalConsentService.js'));
  const middlewarePath = require.resolve(path.join(ROOT, 'middleware', 'politicalConsent.js'));
  const originals = new Map([
    [configPath, require.cache[configPath]],
    [servicePath, require.cache[servicePath]],
    [middlewarePath, require.cache[middlewarePath]]
  ]);

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { getPool: () => ({}) }
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      async getPoliticalConsentState() {
        return { exists: true, granted };
      }
    }
  };
  delete require.cache[middlewarePath];
  const { requirePoliticalConsent } = require(middlewarePath);

  const app = express();
  app.post('/guard', (req, _res, next) => {
    req.userId = 'u1';
    next();
  }, requirePoliticalConsent, (_req, res) => res.json({ success: true }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [modulePath, cached] of originals) {
      if (cached) require.cache[modulePath] = cached;
      else delete require.cache[modulePath];
    }
  }
}

test('middleware consenso restituisce 403 stabile senza consenso e lascia passare con consenso', async () => {
  await serveGuard(false, async (base) => {
    const response = await fetch(`${base}/guard`, { method: 'POST' });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, 'POLITICAL_CONSENT_REQUIRED');
    assert.equal(body.consent_required, true);
  });

  await serveGuard(true, async (base) => {
    const response = await fetch(`${base}/guard`, { method: 'POST' });
    assert.equal(response.status, 200);
  });
});
