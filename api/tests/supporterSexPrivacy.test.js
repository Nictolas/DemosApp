'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HANDLERS = [
  ['api/routes/sostenitori.js', '/'],
  ['api/routes/sostenitori.js', '/organizzazione'],
  ['api/routes/sostenitori-totale.js', '/totale'],
  ['api/routes/attivisti-sostenitori.js', '/sostenitori'],
  ['api/routes/candidati-sostenitori.js', '/sostenitori'],
  ['api/routes/organizzazioni-sostenitori.js', '/sostenitori'],
  ['api/routes/rappresentanti-sostenitori.js', '/sostenitori']
];

const read = rel => fs.readFileSync(path.resolve(ROOT, rel), 'utf8');

function buildRows({ men = 12, women = 10, unknown = 4, organizations = 2 } = {}) {
  const rows = [];
  const insert = (n, sesso, account_type) => {
    for (let i = 0; i < n; i += 1) {
      rows.push({
        id: 'user-' + rows.length,
        nome: 'Test',
        cognome: 'Persona',
        ruolo: 'E',
        email: 'tester@example.test',
        sesso,
        account_type,
        data_nascita: null,
        regione_residenza: null,
        provincia_residenza: null,
        comune_residenza: null,
        created_at: '2026-01-01T00:00:00Z',
        supporter_role: 'Rappresentante'
      });
    }
  };
  insert(men, 'M', 'PERSON');
  insert(women, 'F', 'PERSON');
  insert(unknown, null, 'PERSON');
  insert(organizations, 'F', 'ORGANIZATION');
  return rows;
}

function loadRoute(relativePath, rows) {
  const handlers = new Map();
  const fakePool = { query: async () => ({ rows }) };
  const router = {
    get(uri, ...fns) { handlers.set(uri, fns[fns.length - 1]); },
    post() {},
    put() {},
    delete() {},
    use() {}
  };
  const mocks = {
    express: { Router: () => router },
    pg: { Pool: class { query(...args) { return fakePool.query(...args); } } },
    dotenv: { config: () => ({}) },
    '../middleware/auth': { verifyToken: (_req, _res, next) => next?.() },
    '../config/database': { getPool: () => fakePool },
    '../utils/locationUtils': {
      decompressUserLocation: v => v,
      compressRegione: v => v
    },
    '../utils/provinceUtils': { decompressProvince: v => v },
    '../services/accountCapabilitiesService': {
      getAccountSubject: async () => null,
      hasCapability: () => false,
      ACCOUNT_TYPES: {}
    },
    '../utils/canonicalSexAggregate': require('../utils/canonicalSexAggregate')
  };
  const file = read(relativePath);
  const module = { exports: {} };
  vm.runInNewContext(file, {
    require: name => {
      if (!Object.prototype.hasOwnProperty.call(mocks, name)) {
        throw new Error(relativePath + ': unexpected require ' + name);
      }
      return mocks[name];
    },
    module,
    process: { env: { NODE_ENV: 'test' } },
    console,
    setTimeout,
    clearTimeout,
    URL,
    Buffer
  }, { filename: relativePath });
  return handlers;
}

async function execute(handler) {
  let statusCode = 200;
  let jsonValue;
  const res = {
    status(status) { statusCode = status; return this; },
    set() { return this; },
    json(value) { jsonValue = value; return this; }
  };
  await handler({
    userId: 'target',
    user: { id: 'target', isAdmin: true },
    query: { sostenuto_id: 'target' }
  }, res);
  assert.equal(statusCode, 200);
  assert.equal(jsonValue.success, true);
  return jsonValue;
}

test('sette endpoint sostenitori usano solo M/F verificati, senza esportare attributi personali', async () => {
  for (const [file, uri] of HANDLERS) {
    const handler = loadRoute(file, buildRows()).get(uri);
    assert.equal(typeof handler, 'function', file + ': missing route ' + uri);
    const payload = await execute(handler);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.stats.sexDistribution)), [
      { sesso: 'M', totale: 12 },
      { sesso: 'F', totale: 10 }
    ], file);
    assert.equal(payload.stats.sexSuppressed, false, file);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.stats.genderDistribution)), {}, file);
    const supporters = payload.supporters ?? payload.data?.sostenitori ?? [];
    assert.ok(supporters.length > 0, file);
    for (const supporter of supporters) {
      assert.equal(Object.prototype.hasOwnProperty.call(supporter, 'sesso'), false, file);
      assert.equal(Object.prototype.hasOwnProperty.call(supporter, 'genere'), false, file);
    }
  }
});

test('sette endpoint nascondono tutta la distribuzione se un gruppo CIE ha 1-9 sostenitori', async () => {
  for (const [file, uri] of HANDLERS) {
    const handler = loadRoute(file, buildRows({ men: 9, women: 15, unknown: 2, organizations: 3 })).get(uri);
    const payload = await execute(handler);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.stats.sexDistribution)), [], file);
    assert.equal(payload.stats.sexSuppressed, true, file);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.stats.genderDistribution)), {}, file);
  }
});

test('la UI mostra dati mancanti/soppressi senza usare il genere legacy o inventare Altro', () => {
  const ui = read('client/src/pages/Sostenitori.tsx');
  assert.match(ui, /stats\.sexDistribution/);
  assert.match(ui, /stats\.sexSuppressed/);
  assert.match(ui, /Nessun sesso anagrafico certificato disponibile/);
  assert.doesNotMatch(ui, /Object\.entries\(stats\.genderDistribution\)/);
  assert.doesNotMatch(ui, /Distribuzione per Genere/);
  for (const [file] of HANDLERS) {
    const source = read(file);
    assert.doesNotMatch(source, /supporter\.genere|row\.genere|s\.genere/);
    assert.doesNotMatch(source, /genderDistribution\.Altro/);
  }
});

test('le directory Attivisti e Organizzazioni e il vecchio endpoint Candidati non pubblicano il genere legacy', () => {
  const paths = ['api/routes/attivisti.js', 'api/routes/organizzazioni.js', 'api/routes/candidati.js'];
  paths.forEach(file => {
    const src = read(file);
    assert.doesNotMatch(src, /(?:u\.)?genere\s*,/);
    assert.doesNotMatch(src, /(?:u\.)?sesso\s*,/);
  });
});
