'use strict';

// Real PostgreSQL 17 SQL regression for Government confidence GET.
// Uses only ephemeral TEMP tables and synthetic IDs on CI localhost.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Pool } = require('pg');

function requireSafeEnvironment() {
  const e = process.env;
  const expected = {
    GITHUB_ACTIONS: 'true',
    POLITICAL_CONSENT_RACE_CI: 'synthetic',
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: 'political_consent_race_ci',
    PGUSER: 'postgres',
    PGPASSWORD: 'synthetic-only'
  };
  for (const [key, val] of Object.entries(expected)) {
    if (e[key] !== val) throw Error('Synthetic CI guard refused connection: ' + key);
  }
  if (e.DATABASE_URL || e.SUPABASE_URL || e.SUPABASE_DB_URL || e.SUPABASE_SERVICE_ROLE_KEY || e.RENDER) {
    throw Error('Refusing production database environment');
  }
}

async function main() {
  requireSafeEnvironment();
  const db = new Pool({
    host: '127.0.0.1', port: 5432, database: 'political_consent_race_ci',
    user: 'postgres', password: 'synthetic-only',
    max: 1, connectionTimeoutMillis: 3500, application_name: 'synthetic_government_confidence_read'
  });
  let client;
  try {
    client = await db.connect();
    const meta = (await client.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(meta.db, 'political_consent_race_ci');
    assert.equal(Math.floor(meta.version / 10000), 17);
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE users(id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents(user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE consenso_governo(userid uuid, risposta text, timestamp timestamptz DEFAULT NOW())');
    const active = '00000000-0000-4000-8000-000000000287';
    const revoked = '00000000-0000-4000-8000-000000000288';
    await client.query('INSERT INTO users VALUES ($1,true),($2,true)', [active, revoked]);
    await client.query('INSERT INTO user_consents VALUES ($1,true),($2,false)', [active, revoked]);
    await client.query("INSERT INTO consenso_governo(userid,risposta) VALUES ($1,'Sì'),($2,'No')", [active, revoked]);

    const source = fs.readFileSync(path.join(__dirname, '../routes/governo.js'), 'utf8');
    const start = source.indexOf('// GET /api/governo/consenso -');
    const end = source.indexOf('// POST /api/governo/consenso -', start);
    assert.ok(start >= 0 && end > start);
    let handlers;
    const poolView = { query: (sql, params) => client.query(sql, params) };
    const { getPoliticalConsentState } = require('../services/politicalConsentService');
    const router = { get(p, ...fns) {
      assert.equal(p, '/consenso');
      handlers = fns;
    } };
    vm.runInNewContext(source.slice(start, end), {
      router, pool: poolView, getPoliticalConsentState,
      verifyAccessToken: token => {
        if (token === 'active') return { userId: active };
        if (token === 'revoked') return { userId: revoked };
        throw Error('synthetic invalid bearer');
      },
      getPreferenceCooldown: async () => ({ isBlocked: true, unlockDate: '2026-10-26T10:00:00Z' }),
      console: { log() {}, warn() {}, error() {} },
      Object, Number
    }, { filename: 'government-confidence-read-pg17.js' });
    assert.equal(handlers.length, 2);

    async function read(token = null) {
      const req = { headers: token ? { authorization: 'Bearer ' + token } : {} };
      const res = {
        statusCode: 200, headers: {}, body: null,
        set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
      };
      await handlers[0](req, res, () => {});
      await handlers[1](req, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.match(res.headers['cache-control'], /no-store/);
      assert.match(res.headers['cache-control'], /private/);
      return res.body.data;
    }

    let data = await read('active');
    assert.equal(data.mioConsenso.risposta, 'Sì');
    assert.equal(data.statistiche['Sì'], 1);
    assert.equal(data.statistiche['No'], 0, 'revoked ballot must not appear in aggregate');
    assert.equal(data.statistiche.totale, 1);
    assert.equal(data.blocco.isBlocked, true);
    assert.equal(JSON.stringify(data).includes(active), false);

    data = await read('revoked');
    assert.equal(data.mioConsenso, null, 'revoked personal vote must not be read');
    assert.equal(data.blocco.isBlocked, false);
    assert.equal(data.statistiche.totale, 1);

    data = await read();
    assert.equal(data.mioConsenso, null);
    assert.equal(data.statistiche.totale, 1);
    data = await read('invalid');
    assert.equal(data.mioConsenso, null);
    assert.equal(data.statistiche.totale, 1);

    // Deliberately keep a residual vote row after revoking the active subject.
    await client.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [active]);
    data = await read('active');
    assert.equal(data.mioConsenso, null);
    assert.equal(data.blocco.isBlocked, false);
    assert.equal(data.statistiche.totale, 0);

    console.log('GOVERNMENT_CONFIDENCE_READ_PG17_SYNTHETIC_PASS');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await db.end();
  }
}

main().catch(error => {
  console.error('GOVERNMENT_CONFIDENCE_READ_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
