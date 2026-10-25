'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const candidateSource = fs.readFileSync(path.join(ROOT, 'routes/candidati.js'), 'utf8');
const representativeSource = fs.readFileSync(path.join(ROOT, 'routes/rappresentanti.js'), 'utf8');

const routes = [
  {
    name: 'candidate',
    code: candidateSource,
    first: 'function emptyCandidateSelectionProjection()',
    last: '// GET /api/candidati -',
    func: 'loadCandidateSelectionProjection',
    descriptors: [{ field: 'candidato_camera', officeId: 'it.camera' }],
    key: 'CANDIDATE_SELECTION_DESCRIPTORS'
  },
  {
    name: 'representative',
    code: representativeSource,
    first: 'function emptyRepresentativeSelectionProjection()',
    last: '// GET /api/rappresentanti/disponibili',
    func: 'loadRepresentativeSelectionProjection',
    descriptors: [{ field: 'rappresentante_camera', officeId: 'it.camera' }],
    key: 'REPRESENTATIVE_SELECTION_DESCRIPTORS'
  }
];

async function callLoader(route, { consent = true, revokeDuringRead = false } = {}) {
  const start = route.code.indexOf(route.first);
  const end = route.code.indexOf(route.last, start);
  assert.ok(start >= 0 && end > start, route.name + ' projection function not found');

  const calls = [];
  const context = {
    pool: { id: 'synthetic-pool' },
    [route.key]: route.descriptors,
    getPoliticalConsentState: async (db, userId) => {
      assert.equal(db.id, 'synthetic-pool');
      assert.equal(userId, 'synthetic-user');
      const count = calls.filter(x => x === 'consent').length;
      calls.push('consent');
      return { exists: true, granted: consent && (!revokeDuringRead || count === 0) };
    },
    loadPoliticalSelections: async (db, options) => {
      assert.equal(db.id, 'synthetic-pool');
      assert.equal(options.userId, 'synthetic-user');
      assert.equal(options.kind, route.name);
      calls.push('load');
      return {
        source: 'CANONICAL',
        strict: true,
        selections: [{ officeId: 'it.camera', selectedUserId: 'synthetic-politician' }]
      };
    },
    selectionsByOffice: state => new Map(state.selections.map(item => [item.officeId, item])),
    Object, Map
  };
  vm.runInNewContext(route.code.slice(start, end) + '\nthis.load = ' + route.func + ';', context);
  const result = await context.load('synthetic-user');
  return { result: JSON.parse(JSON.stringify(result)), calls };
}

for (const route of routes) {
  test(route.name + ': active consent preserves a personal political selection', async () => {
    const { result, calls } = await callLoader(route);
    assert.deepEqual(calls, ['consent', 'load', 'consent']);
    assert.equal(result.projection[route.descriptors[0].field], 'synthetic-politician');
  });

  test(route.name + ': revoked consent never reads residual canonical/legacy rows', async () => {
    const { result, calls } = await callLoader(route, { consent: false });
    assert.deepEqual(calls, ['consent']);
    assert.equal(result.projection[route.descriptors[0].field], null);
    assert.deepEqual(result.state.selections, []);
  });

  test(route.name + ': consent revoked during selection lookup drops earlier snapshot', async () => {
    const { result, calls } = await callLoader(route, { revokeDuringRead: true });
    assert.deepEqual(calls, ['consent', 'load', 'consent']);
    assert.equal(result.projection[route.descriptors[0].field], null);
  });

  test(route.name + ': code checks consent again at response time and prevents HTTP caching', () => {
    const s = route.code;
    assert.ok(s.includes("res.set('Cache-Control', 'private, no-store, max-age=0')"));
    assert.ok(s.includes('const finalConsent = await getPoliticalConsentState(pool, userId)'));
    const responses = s.match(/finalConsent\.granted \? [a-zA-Z]+ : \{\}/g) || [];
    assert.ok(responses.length >= 2, 'Must strip IDs and details if consent revoked');
  });
}

test('GET candidate selections suppresses personal candidate names on a final revoked state', async () => {
  const start = candidateSource.indexOf("router.get('/selezioni', verifyToken");
  const end = candidateSource.indexOf('module.exports = router;', start);
  assert.ok(start > 0 && end > start);
  let handlers;
  const selectedId = 'synthetic-politician';
  const logArgs = [];
  const router = { get(p, ...fn) { assert.equal(p, '/selezioni'); handlers = fn; } };
  const context = {
    router,
    verifyToken: (_req, _res, next) => next(),
    loadCandidateSelectionProjection: async () => ({ projection: { candidato_camera: selectedId } }),
    CANDIDATE_SELECTION_DESCRIPTORS: [{ field: 'candidato_camera', category: 'camera' }],
    getPoliticalConsentState: async () => ({ granted: false }),
    pool: {
      query: async (_sql, params) => {
        assert.deepEqual(Array.from(params), [selectedId]);
        return { rows: [{ id: selectedId, nome: 'Synthetic Secret' }] };
      }
    },
    console: { log: (...a) => logArgs.push(a), error: (...a) => logArgs.push(a) }
  };
  vm.runInNewContext(candidateSource.slice(start, end), context);
  const res = {
    body: null,
    statusCode: 200,
    json(data) { this.body = data; return this; },
    status(status) { this.statusCode = status; return this; }
  };
  const req = { userId: 'synthetic-user' };
  await handlers.at(-1)(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body.data)), { candidati: {}, idMap: {} });
  assert.equal(JSON.stringify(logArgs).includes('synthetic-politician'), false);
});

test('GET representative selections suppresses personal names on a final revoked state', async () => {
  const start = representativeSource.indexOf("router.get('/', verifyToken");
  const end = representativeSource.indexOf('// POST /api/rappresentanti -', start);
  assert.ok(start > 0 && end > start);
  let handlers;
  const selectedId = 'synthetic-politician';
  const router = { get(p, ...fn) { assert.equal(p, '/'); handlers = fn; } };
  const context = {
    router,
    verifyToken: (_req, _res, next) => next(),
    loadRepresentativeSelectionProjection: async () => ({ projection: { rappresentante_camera: selectedId } }),
    REPRESENTATIVE_SELECTION_DESCRIPTORS: [{ field: 'rappresentante_camera', category: 'camera' }],
    getPoliticalConsentState: async () => ({ granted: false }),
    pool: {
      query: async (_sql, params) => {
        assert.deepEqual(Array.from(params), [selectedId]);
        return { rows: [{ id: selectedId, nome: 'Synthetic', cognome: 'Secret' }] };
      }
    },
    console: { log() { throw Error('Personal selection logged'); }, error() {} }
  };
  vm.runInNewContext(representativeSource.slice(start, end), context);
  const res = {
    body: null,
    statusCode: 200,
    json(data) { this.body = data; return this; },
    status(status) { this.statusCode = status; return this; }
  };
  await handlers.at(-1)({ userId: 'synthetic-user' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body.data)), { rappresentanti: {}, idMap: {} });
});

test('consent-scoped selections remain a separate erasure-policy decision', () => {
  const { CONSENT_SCOPED_TABLES } = require('../services/politicalConsentService');
  assert.equal(CONSENT_SCOPED_TABLES.includes('political_selections'), false);
  assert.equal(CONSENT_SCOPED_TABLES.includes('user_representatives'), false);
});
