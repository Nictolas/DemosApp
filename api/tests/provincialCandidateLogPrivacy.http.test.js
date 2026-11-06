'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual candidate availability handler in a synthetic HTTP
// harness. No database connection, real account, staging, or credentials.
const full = fs.readFileSync(path.join(__dirname, '..', 'routes', 'candidati.js'), 'utf8');
const start = full.indexOf("router.get('/disponibili',");
const end = full.indexOf('// PUT /api/candidati/seleziona-candidato', start);
assert.ok(start >= 0 && end > start, 'candidate availability route exists');
const endpoint = full.slice(start, end);

function isolate({ released = true, fail = false } = {}) {
  const logged = [];
  let handlers = [];
  let eligibleCalls = 0;
  let matchCalls = 0;
  const router = {
    get(route, ...args) {
      assert.equal(route, '/disponibili');
      handlers = args;
    },
  };
  const verifyToken = (_req, _res, next) => next();
  const listEligibleCandidates = async () => {
    eligibleCalls++;
    if (fail) throw new Error('SYNTHETIC_PRIVATE_SQL_ERROR');
    return {
      subjects: [{ id: 'private-candidate', nome: 'Synthetic', cognome: 'Person', ruolo: 'C' }],
      source: 'CAPABILITY', strict: true, reason: null,
    };
  };
  const buildPoliticalMatches = async () => {
    matchCalls++;
    return { matches: [{ id: 'private-candidate', matching_score: 91, compatibilita_percentuale: 90 }] };
  };
  vm.runInNewContext(endpoint, {
    router, verifyToken,
    resolvePoliticalOffice: () => ({ id: 'it.provincial.trento' }),
    isPoliticalOfficeVisible: () => released,
    listEligibleCandidates,
    getMatchingOpinionGradeForOffice: () => 'C',
    buildPoliticalMatches,
    console: {
      log: (...args) => logged.push(args),
      warn: (...args) => logged.push(args),
      error: (...args) => logged.push(args),
    },
  }, { filename: 'synthetic-provincial-candidate-list.js' });
  return {
    get logs() { return logged; },
    get reads() { return { eligibleCalls, matchCalls }; },
    async request(grade = 'it.provincial.trento') {
      const req = { userId: 'synthetic-owner', query: { grado_candidatura: grade } };
      const res = {
        code: 200, body: null,
        status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; },
      };
      for (const middleware of handlers) {
        let advanced = false;
        await middleware(req, res, () => { advanced = true; });
        if (!advanced) break;
      }
      return res;
    },
  };
}

test('synthetic candidate availability does not log names, IDs or political match scores', async () => {
  const app = isolate();
  const res = await app.request();
  assert.equal(res.code, 200);
  assert.equal(res.body.data[0].id, 'private-candidate');
  assert.deepEqual(app.reads, { eligibleCalls: 1, matchCalls: 1 });
  assert.deepEqual(app.logs, []);
});

test('unreleased provincial candidate list is rejected before eligibility or matching SQL', async () => {
  const app = isolate({ released: false });
  const res = await app.request();
  assert.equal(res.code, 409);
  assert.equal(res.body.error, 'PROVINCIAL_SELECTION_NOT_RELEASED');
  assert.deepEqual(app.reads, { eligibleCalls: 0, matchCalls: 0 });
  assert.deepEqual(app.logs, []);
});

test('synthetic SQL error cannot leak through response or server logging', async () => {
  const app = isolate({ fail: true });
  const res = await app.request();
  assert.equal(res.code, 500);
  assert.equal(res.body.error, 'Errore interno del server');
  assert.doesNotMatch(JSON.stringify(res.body), /SYNTHETIC_PRIVATE_SQL_ERROR/);
  assert.deepEqual(app.logs, []);
});

test('missing candidate grade does not query private availability', async () => {
  const app = isolate();
  const res = await app.request('');
  assert.equal(res.code, 400);
  assert.deepEqual(app.reads, { eligibleCalls: 0, matchCalls: 0 });
});