'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/users/public-profile.js'), 'utf8');
const start = source.indexOf('const SCHEMA_FALLBACK_CODES');
const end = source.indexOf('module.exports = router;', start);
assert.ok(start >= 0 && end > start, 'Expected actual public-profile route and helpers');
const routeSource = source.slice(start, end);

async function request({
  granted = true, revokeBeforeResponse = false, authenticated = true,
  eligible = true, missingTable = false, databaseFailure = false,
  targetFound = true
} = {}) {
  let handlers, consentChecks = 0;
  const reads = [], logs = [];
  const targetId = '00000000-0000-4000-8000-000000000292';
  const pool = {
    async query(sql, params) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      reads.push(q);
      if (databaseFailure) throw Error('synthetic-sensitive-sql-param');
      if (q.includes('FROM users u') && !q.includes('voti_')) {
        assert.deepEqual(Array.from(params), [targetId]);
        return { rows: targetFound ? [{
          id: targetId, nome: 'Synthetic', cognome: 'Candidate',
          rappresentante_europeo: null, candidato_europeo: null
        }] : [] };
      }
      if (q.includes('FROM voti_')) {
        assert.match(q, /FROM voti_[a-z_]+ v/);
        assert.match(q, /JOIN users u ON u\.id::text = v\.userid::text/);
        assert.match(q, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
        assert.match(q, /COALESCE\(\s*uc\.political_opinions_consent,\s*u\.political_opinions_consent,\s*false\s*\) IS TRUE/);
        assert.match(q, /WHERE v\.userid::text = \$1::text/);
        assert.deepEqual(Array.from(params), [targetId]);
        if (missingTable && q.includes('voti_cultura')) {
          const error = Error('synthetic missing table');
          error.code = '42P01';
          throw error;
        }
        if (q.includes('voti_difesa')) return { rows: [{ nome_display: 'Synthetic Minister' }] };
        return { rows: [] };
      }
      throw Error('Unexpected DB query: ' + q);
    }
  };
  const pass = (_req, _res, next) => next();
  const router = {
    get(route, ...fns) {
      assert.equal(route, '/:userId/public-profile');
      handlers = fns;
    }
  };
  vm.runInNewContext(routeSource, {
    router, pool,
    verifyToken: authenticated ? pass : (_req, res) => res.status(401).json({ success: false }),
    getAccountSubject: async (_db, id) => {
      assert.equal(id, targetId);
      return eligible ? {
        status: 'a',
        legacyRole: 'C',
        capabilities: { isCandidate: true, isPolitician: false }
      } : { status: 'a', capabilities: { isCandidate: false, isPolitician: false } };
    },
    decompressUserLocation: user => user,
    getPoliticalConsentState: async (db, id) => {
      assert.equal(db, pool);
      assert.equal(id, targetId);
      consentChecks++;
      return { exists: targetFound, granted: granted && (!revokeBeforeResponse || consentChecks < 2) };
    },
    console: { error: (...args) => logs.push(args), log: (...args) => logs.push(args) },
    JSON, Set, Map, String
  }, { filename: 'public-profile-read-test.js' });
  assert.equal(handlers?.length, 3, 'No-store middleware must run before authentication');
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = { params: { userId: targetId } };
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  assert.match(res.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(JSON.stringify(logs).includes('synthetic-sensitive-sql-param'), false);
  return { res, reads, logs, consentChecks };
}

test('public candidate with active consent can expose the desired government', async () => {
  const { res, reads, consentChecks } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.public.governoIdeale.difesa, 'Synthetic Minister');
  assert.equal(res.body.user.nome, 'Synthetic');
  assert.equal(consentChecks, 2);
  assert.equal(reads.filter(q => q.includes('FROM voti_')).length, 14);
});

test('revoked consent never reads remaining political votes from a public profile', async () => {
  const { res, reads, consentChecks } = await request({ granted: false });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body.public.governoIdeale)), {});
  assert.equal(reads.filter(q => q.includes('FROM voti_')).length, 0);
  assert.equal(consentChecks, 2);
});

test('revocation after loading votes but before projection hides snapshot', async () => {
  const { res, reads } = await request({ revokeBeforeResponse: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body.public.governoIdeale)), {});
  assert.equal(reads.filter(q => q.includes('FROM voti_')).length, 14);
});

test('legacy absent ministry table is ignored, but other choices remain', async () => {
  const { res } = await request({ missingTable: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.public.governoIdeale.difesa, 'Synthetic Minister');
  assert.equal(res.body.public.governoIdeale.cultura, undefined);
});

test('non-public accounts return 404 with no sensitive database reads', async () => {
  const { res, reads } = await request({ eligible: false });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(reads, []);
});

test('unknown target returns 404, without reading political ballots', async () => {
  const { res, reads } = await request({ targetFound: false });
  assert.equal(res.statusCode, 404);
  assert.equal(reads.filter(q => q.includes('FROM voti_')).length, 0);
});

test('authentication rejection is no-store and performs no database query', async () => {
  const { res, reads } = await request({ authenticated: false });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(reads, []);
});

test('unexpected SQL error returns sanitized 500 without partial political responses', async () => {
  const { res } = await request({ databaseFailure: true });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('synthetic-sensitive-sql-param'), false);
});

test('public projection never logs bearer or personal preference SQL errors', () => {
  assert.doesNotMatch(routeSource, /console\.(?:log|warn)\s*\(/);
  assert.doesNotMatch(routeSource, /console\.error\([^)]*\berror\b/);
});

test('CDN policy includes public profile through user route prefix', () => {
  const policy = require('../config/publicCachePolicy');
  assert.ok(policy.neverCachePathPrefixes.some(prefix =>
    '/api/users/00000000-0000-4000-8000-000000000292/public-profile'.startsWith(prefix)
  ));
});

test('consent revocation erasure scope includes all public profile minister selections', () => {
  const { CONSENT_SCOPED_TABLES } = require('../services/politicalConsentService');
  for (const name of ['voti_difesa','voti_esteri','voti_primo_ministro','voti_sport']) {
    assert.ok(CONSENT_SCOPED_TABLES.includes(name), name);
  }
});
