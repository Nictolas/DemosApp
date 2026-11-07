'use strict';

// Isolated integration contract for the route shared with consent PR #557.
// This tests the actual profile route body without a database, credentials,
// Chrome session or the unified staging environment.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const profileSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'users', 'profile.js'), 'utf8'
);
const start = profileSource.indexOf("router.get('/:userId/opinioni'");
const end = profileSource.indexOf('// PUT /api/users/:userId/opinioni', start);
assert.ok(start >= 0 && end > start, 'personal opinion GET route must exist');

function createResponse() {
  return {
    code: 200, headers: {}, body: undefined,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.code = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function isolateProfile({
  consent = true, viewer = 'owner', subjectRole = 'citizen',
  authenticated = true, exists = true, dbError = false
} = {}) {
  const queries = [];
  let handlers;
  const router = {
    get(route, ...registered) {
      assert.equal(route, '/:userId/opinioni');
      handlers = registered;
    }
  };
  const pool = {
    async query(sql, values) {
      const statement = String(sql);
      queries.push(statement);
      assert.deepEqual([...values], ['synthetic-target']);
      assert.match(statement, /FROM opinioni_risposte r/);
      assert.match(statement, /JOIN users u ON u.id = r.user_id/);
      assert.match(statement, /LEFT JOIN user_consents uc ON uc.user_id = u.id/);
      assert.match(statement, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
      if (dbError) throw new Error('SYNTHETIC_PRIVATE_SQL_ERROR');
      return {
        rows: consent ? [{
          user_id: 'synthetic-target', caccia: 'f',
          fonti_opinioni: { caccia: 'SYNTHETIC_PRIVATE_SOURCE' }
        }] : []
      };
    }
  };
  const getAccountSubject = async () => exists ? ({
    id: 'synthetic-target', capabilities: {
      isCandidate: subjectRole === 'candidate',
      isPolitician: subjectRole === 'politician'
    }
  }) : null;
  const verifyToken = (_req, res, next) => authenticated
    ? next() : res.status(401).json({ success: false });
  const userDataAuditMiddleware = (_req, _res, next) => next();
  const question = { id: 'caccia', text: 'Caccia', gradi_opinione: ['N'] };

  vm.runInNewContext(profileSource.slice(start, end), {
    router, verifyToken, userDataAuditMiddleware, getAccountSubject, pool,
    getOpinionsForGrade: () => [question],
    getAllOpinions: () => [question],
    sortOpinionsByText: (items) => items,
    console: { log() {}, error() {} }
  }, { filename: 'synthetic-profile-opinion-consent.js' });

  assert.equal(handlers.length, 4, 'no-store must precede auth and audit');
  return async function read() {
    const res = createResponse();
    const viewerId = viewer === 'owner' ? 'synthetic-target' : 'synthetic-other';
    const req = {
      userId: viewerId,
      user: { id: viewerId, isAdmin: viewer === 'admin' },
      params: { userId: 'synthetic-target' },
      query: { grado: 'N' }
    };
    for (const middleware of handlers.slice(0, -1)) {
      let nextCalled = false;
      await middleware(req, res, () => { nextCalled = true; });
      if (!nextCalled) break;
    }
    if (res.body === undefined) await handlers.at(-1)(req, res);
    assert.equal(res.headers['cache-control'], 'private, no-store, max-age=0');
    return { res, queries };
  };
}

test('profile opinion read remains one consent-guarded SELECT and returns source for consented owner', async () => {
  const { res, queries } = await isolateProfile()();
  assert.equal(res.code, 200);
  assert.equal(res.body.data.opinioni[0].userAnswer, 'f');
  assert.equal(res.body.data.fonti.caccia, 'SYNTHETIC_PRIVATE_SOURCE');
  assert.equal(queries.length, 1);
});

test('revoked political consent masks vote and source, including for a candidate', async () => {
  for (const scenario of [
    { consent: false, viewer: 'owner' },
    { consent: false, viewer: 'other', subjectRole: 'candidate' },
    { consent: false, viewer: 'other', subjectRole: 'politician' }
  ]) {
    const { res, queries } = await isolateProfile(scenario)();
    assert.equal(res.code, 200);
    assert.equal(res.body.data.opinioni[0].userAnswer, null);
    assert.equal(Object.keys(res.body.data.fonti).length, 0);
    assert.doesNotMatch(JSON.stringify(res.body), /SYNTHETIC_PRIVATE_SOURCE/);
    assert.equal(queries.length, 1);
  }
});

test('unrelated citizen, missing account and unauthenticated caller never read personal answers', async () => {
  for (const scenario of [
    { viewer: 'other' }, { exists: false }, { authenticated: false }
  ]) {
    const { res, queries } = await isolateProfile(scenario)();
    assert.ok([401, 403, 404].includes(res.code));
    assert.equal(queries.length, 0);
  }
});

test('personal opinion query failures are no-store and never expose SQL error details', async () => {
  const { res, queries } = await isolateProfile({ dbError: true })();
  assert.equal(res.code, 500);
  assert.equal(queries.length, 1);
  assert.doesNotMatch(JSON.stringify(res.body), /SYNTHETIC_PRIVATE_SQL_ERROR/);
});
