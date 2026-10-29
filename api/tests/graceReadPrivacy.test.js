'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = fs.readFileSync(path.join(__dirname, '../routes/grazia.js'), 'utf8');
const start = routeSource.indexOf('// GET /api/grazia -');
const end = routeSource.indexOf('// GET /api/grazia/richieste -', start);
assert.ok(start >= 0 && end > start, 'Expected public catalog route');
const source = routeSource.slice(start, end);
const assertConsentPredicate = (sql) => {
  assert.match(sql, /JOIN\s+users\s+u\s+ON\s+u\.id::text\s*=\s*vg\."(?:userid|user_id|userId)"::text/);
  assert.match(sql, /LEFT\s+JOIN\s+user_consents\s+uc\s+ON\s+uc\.user_id\s*=\s*u\.id/);
  assert.match(sql, /COALESCE\s*\(\s*uc\.political_opinions_consent,\s*u\.political_opinions_consent,\s*false\s*\)\s+IS\s+TRUE/);
};

async function perform({ granted = true, override = null, authenticated = true, tokenValid = true,
  column = 'userid', failColumns = false } = {}) {
  let routes;
  const queries = [];
  const calls = [];
  const effectiveConsent = override === null ? granted : override;
  const pool = {
    async query(sql, params) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      queries.push(statement);
      if (statement.includes('FROM information_schema.columns')) {
        if (failColumns) throw new Error('synthetic schema failure');
        return { rows: [{ column_name: column }, { column_name: 'timestamp' }] };
      }
      if (statement.startsWith('WITH voti_per_nome')) {
        assertConsentPredicate(statement);
        assert.doesNotMatch(statement, /SELECT\s+\*/i);
        return { rows: [{ nome: 'Synthetic Example', richieste: effectiveConsent ? 1 : 0 }] };
      }
      if (statement.startsWith('SELECT vg.nome')) {
        assertConsentPredicate(statement);
        assert.match(statement, new RegExp('WHERE vg\\."' + column + '" = \\$1'));
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        return { rows: effectiveConsent ?
          [{ nome: 'Synthetic Example', changed_at: '2026-10-25T08:00:00Z' }] : [] };
      }
      throw new Error('Unexpected query: ' + statement);
    }
  };
  const router = { get(route, ...handlers) {
    assert.equal(route, '/'); routes = handlers;
  }};
  vm.runInNewContext(source, {
    router, pool,
    process: { env: { JWT_SECRET: 'synthetic-only' } },
    require: (name) => {
      assert.equal(name, 'jsonwebtoken');
      return { verify() {
        if (!tokenValid) throw new Error('synthetic invalid JWT');
        return { userId: 'synthetic-user' };
      }};
    },
    getPreferenceCooldown: async (_pool, args) => {
      calls.push(args);
      return { isBlocked: true, unlockDate: '2026-10-26T08:00:00Z' };
    },
    console: { log() {}, warn() {}, error() {} }
  }, { filename: 'grazia-public-handler.js' });
  assert.equal(routes.length, 2);
  const res = { statusCode: 200, headers: {}, body: null,
    set(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = { headers: authenticated ? { authorization: 'Bearer synthetic' } : {} };
  let calledNext = false;
  await routes[0](req, res, () => { calledNext = true; });
  assert.equal(calledNext, true);
  await routes[1](req, res);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  return { res, queries, calls };
}

test('public Grazia route never reads or returns raw rows from voti_grazia', async () => {
  assert.doesNotMatch(source, /SELECT\s+\*\s+FROM\s+voti_grazia/i);
  const { res } = await perform();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Array.from(res.body.richieste), []);
  assert.equal(JSON.stringify(res.body).includes('synthetic-user'), false);
  assert.equal(res.body.classifica[0].richieste, 1);
  assert.deepEqual(Array.from(res.body.mieiVoti), ['Synthetic Example']);
  assert.equal(res.body.blocco.isBlocked, true);
});

test('revoked and absent consent hide residual votes and cooldown data', async () => {
  for (const options of [{ granted: false }, { granted: true, override: false }]) {
    const { res, calls } = await perform(options);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.classifica[0].richieste, 0);
    assert.deepEqual(Array.from(res.body.mieiVoti), []);
    assert.equal(res.body.blocco.isBlocked, false);
    assert.equal(calls.length, 0);
  }
});

test('anonymous and invalid tokens return only aggregated data', async () => {
  for (const options of [{ authenticated: false }, { tokenValid: false }]) {
    const { res, queries } = await perform(options);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Array.from(res.body.mieiVoti), []);
    assert.equal(queries.some(sql => sql.startsWith('SELECT vg.nome')), false);
    assert.deepEqual(Array.from(res.body.richieste), []);
  }
});

test('allowlisted alternate user ID column still filters personal and aggregated votes', async () => {
  const { res } = await perform({ column: 'user_id' });
  assert.deepEqual(Array.from(res.body.mieiVoti), ['Synthetic Example']);
});

test('schema failure does not leak data or produce cacheable errors', async () => {
  const { res } = await perform({ failColumns: true });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('synthetic schema failure'), false);
});

test('CDN excludes even the anonymous mixed Grazia catalog from caching', () => {
  const policy = require('../config/publicCachePolicy');
  assert.ok(policy.neverCachePathPrefixes.some(prefix => '/api/grazia'.startsWith(prefix)));
});
