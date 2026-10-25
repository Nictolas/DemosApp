'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Isolated execution of the real route handler, with synthetic database rows only.
const source = fs.readFileSync(path.join(__dirname, '../routes/users/profile.js'), 'utf8');
const start = source.indexOf("router.get('/:userId/opinioni'");
const end = source.indexOf('// PUT /api/users/:userId/opinioni', start);
assert.ok(start >= 0 && end > start, 'profile opinion route must exist');
const routeCode = source.slice(start, end);

async function request({ granted = true, override = null, viewer = 'owner', targetRole = 'private', targetExists = true, authenticated = true } = {}) {
  let chain;
  const statements = [];
  const pool = {
    async query(sql, params = []) {
      statements.push(String(sql));
      if (sql.includes('FROM opinioni_domande')) {
        return { rows: [{ id: 'caccia', text: 'Caccia', gradi_opinione: ['N'] }] };
      }
      if (sql.includes('FROM opinioni_risposte')) {
        assert.match(sql, /JOIN\s+users\s+u\s+ON\s+u\.id\s*=\s*r\.user_id/);
        assert.match(sql, /LEFT\s+JOIN\s+user_consents\s+uc\s+ON\s+uc\.user_id\s*=\s*u\.id/);
        assert.match(sql, /COALESCE\s*\(\s*uc\.political_opinions_consent\s*,\s*u\.political_opinions_consent\s*,\s*false\s*\)\s+IS\s+TRUE/);
        assert.deepEqual(Array.from(params), ['target']);
        const allowed = override === null ? granted : override;
        return { rows: allowed ? [{ user_id: 'target', caccia: 'f', fonti_opinioni: { caccia: 'synthetic-private-source' } }] : [] };
      }
      throw new Error('Unexpected synthetic SQL: ' + sql);
    }
  };
  const subject = targetExists ? {
    id: 'target', capabilities: { isPolitician: targetRole === 'politician', isCandidate: targetRole === 'candidate' }
  } : null;
  const router = { get(route, ...handlers) {
    assert.equal(route, '/:userId/opinioni');
    chain = handlers;
  } };
  const passthrough = (_req, _res, next) => next();
  const verifyToken = (req, res, next) => authenticated ? next() : res.status(401).json({ success: false });
  vm.runInNewContext(routeCode, {
    router, verifyToken, userDataAuditMiddleware: passthrough,
    getAccountSubject: async () => subject, pool,
    console: { log() {}, error() {} }
  }, { filename: 'profile-opinions-handler.js' });
  assert.ok(chain && chain.length >= 3, 'response policy must precede authentication');
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const userId = viewer === 'owner' ? 'target' : 'viewer';
  const req = { params: { userId: 'target' }, query: { grado: 'N' }, userId, user: { id: userId, isAdmin: viewer === 'admin' } };
  for (const middleware of chain.slice(0, -1)) {
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  if (res.body === null) await chain[chain.length - 1](req, res);
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)no-store(?:,|$)/);
  return { res, statements };
}

test('owner with active consent receives own answer and source', async () => {
  const { res } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.opinioni[0].userAnswer, 'f');
  assert.equal(res.body.data.fonti.caccia, 'synthetic-private-source');
});

test('revoked or absent consent never exposes residual answer or source', async () => {
  for (const props of [{ granted: false }, { granted: true, override: false }, { granted: false, targetRole: 'candidate', viewer: 'other' }]) {
    const { res, statements } = await request(props);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.opinioni[0].userAnswer, null);
    assert.equal(Object.keys(res.body.data.fonti).length, 0);
    assert.ok(statements.some(sql => sql.includes('FROM opinioni_risposte')));
  }
});

test('explicit consent override allows the public candidate opinion read', async () => {
  const { res } = await request({ granted: false, override: true, targetRole: 'candidate', viewer: 'other' });
  assert.equal(res.body.data.opinioni[0].userAnswer, 'f');
});

test('private citizens remain private to unrelated authenticated viewers', async () => {
  const { res, statements } = await request({ viewer: 'other' });
  assert.equal(res.statusCode, 403);
  assert.equal(statements.some(sql => sql.includes('FROM opinioni_risposte')), false);
});

test('missing subject and authentication errors are never cacheable', async () => {
  const missing = await request({ targetExists: false });
  assert.equal(missing.res.statusCode, 404);
  const denied = await request({ authenticated: false });
  assert.equal(denied.res.statusCode, 401);
  assert.equal(denied.statements.length, 0);
});
