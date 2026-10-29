'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fullSource = fs.readFileSync(path.join(__dirname, '../routes/capo-stato.js'), 'utf8');
const start = fullSource.indexOf('// GET /api/capo-stato -');
const end = fullSource.indexOf('// Endpoint rimosso - duplicato', start);
assert.ok(start >= 0 && end > start, 'GET /api/capo-stato must exist');
const source = fullSource.slice(start, end);

function assertConsent(sql) {
  assert.match(sql, /JOIN\s+users\s+u\s+ON\s+u\.id::text\s*=\s*v\."(?:userid|userId|user_id)"::text/);
  assert.match(sql, /LEFT\s+JOIN\s+user_consents\s+uc\s+ON\s+uc\.user_id\s*=\s*u\.id/);
  assert.match(sql, /COALESCE\(\s*uc\.political_opinions_consent,\s*u\.political_opinions_consent,\s*false\s*\)\s+IS\s+TRUE/);
}

async function request({ granted = true, override = null, column = 'userid', tokenValid = true,
  authenticated = true, role = 'E', columnsFail = false } = {}) {
  const queries = [];
  const cooldowns = [];
  let handlers;
  const permitted = override === null ? granted : override;
  const pool = {
    async query(sql, params) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      queries.push(statement);
      if (statement.includes('FROM information_schema.columns')) {
        if (columnsFail) throw new Error('synthetic database failure');
        return { rows: [{ column_name: column }] };
      }
      if (statement.startsWith('SELECT v.nome, COUNT(*) AS voti')) {
        assertConsent(statement);
        assert.doesNotMatch(statement, /SELECT\s+\*/i);
        return { rows: permitted ? [{ nome: 'Eligible Synthetic', voti: '1' }] : [] };
      }
      if (statement.startsWith('SELECT v.nome, v.timestamp AS changed_at')) {
        assertConsent(statement);
        assert.match(statement, new RegExp('WHERE v\\."' + column + '" = \\$1'));
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        return { rows: permitted ? [{
          nome: 'Eligible Synthetic', changed_at: '2026-10-25T06:00:00Z', ruolo: role
        }] : [] };
      }
      throw new Error('Unexpected SQL: ' + statement);
    }
  };
  const router = {
    get(name, ...list) {
      assert.equal(name, '/');
      handlers = list;
    }
  };
  const logs = [];
  vm.runInNewContext(source, {
    router, pool,
    jwt: { verify() {
      if (!tokenValid) throw new Error('synthetic invalid JWT');
      return { userId: 'synthetic-user' };
    } },
    process: { env: { JWT_SECRET: 'synthetic' } },
    isIneligibleCandidate: () => false,
    getPreferenceCooldown: async (_pool, args) => {
      cooldowns.push(args);
      return { isBlocked: true, unlockDate: '2026-10-26T06:00:00Z' };
    },
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) }
  }, { filename: 'head-of-state-get.js' });
  assert.equal(handlers.length, 2);
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = { headers: authenticated ? { authorization: 'Bearer synthetic' } : {} };
  let nextInvoked = false;
  await handlers[0](req, res, () => { nextInvoked = true; });
  assert.equal(nextInvoked, true);
  await handlers[1](req, res);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  return { res, queries, cooldowns, logs };
}

test('active consent returns matching public aggregate and only own choice', async () => {
  const { res, queries, cooldowns } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.classifica[0].voti, 1);
  assert.deepEqual(Array.from(res.body.mieiVoti), ['Eligible Synthetic']);
  assert.equal(res.body.blocco.isBlocked, true);
  assert.equal(cooldowns.length, 1);
  assert.equal(queries.filter(q => q.includes('FROM voti_capo_stato')).length, 2);
});

test('revoked or absent consent excludes residual choice from rankings and personal response', async () => {
  for (const props of [{ granted: false }, { granted: true, override: false }]) {
    const { res, cooldowns } = await request(props);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Array.from(res.body.classifica), []);
    assert.deepEqual(Array.from(res.body.mieiVoti), []);
    assert.equal(res.body.blocco.isBlocked, false);
    assert.equal(cooldowns.length, 0);
  }
});

test('anonymous and invalid tokens cannot retrieve a personalized choice', async () => {
  for (const props of [{ authenticated: false }, { tokenValid: false }]) {
    const { res, queries } = await request(props);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Array.from(res.body.mieiVoti), []);
    assert.equal(queries.some(s => s.startsWith('SELECT v.nome, v.timestamp AS changed_at')), false);
  }
});

test('alternate allowlisted userId column and admin-role cooldown behavior', async () => {
  const { res, cooldowns } = await request({ column: 'userId', role: 'AD' });
  assert.deepEqual(Array.from(res.body.mieiVoti), ['Eligible Synthetic']);
  assert.equal(cooldowns.length, 0);
});

test('query failure fails closed with no-store and no internal error details', async () => {
  const { res } = await request({ columnsFail: true });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('synthetic database failure'), false);
});

test('CDN policy excludes root and consent routes from shared caching', () => {
  const policy = require('../config/publicCachePolicy');
  for (const path of ['/api/capo-stato', '/api/capo-stato/consenso']) {
    assert.ok(policy.neverCachePathPrefixes.some(prefix => path.startsWith(prefix)), path);
  }
});
