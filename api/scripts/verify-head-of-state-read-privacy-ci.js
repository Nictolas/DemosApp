'use strict';

// Integration test ONLY for PostgreSQL 17 on CI localhost, using TEMP tables.
// This script rejects any non-synthetic environment before connecting.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Pool } = require('pg');

function requireSyntheticCi() {
  const expected = {
    GITHUB_ACTIONS: 'true',
    POLITICAL_CONSENT_RACE_CI: 'synthetic',
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: 'political_consent_race_ci',
    PGUSER: 'postgres',
    PGPASSWORD: 'synthetic-only'
  };
  for (const [key, value] of Object.entries(expected)) {
    if (process.env[key] !== value) throw Error('Synthetic CI guard denied connection: ' + key);
  }
}

async function main() {
  requireSyntheticCi();
  const pool = new Pool({
    host: '127.0.0.1', port: 5432, database: 'political_consent_race_ci',
    user: 'postgres', password: 'synthetic-only',
    max: 1, connectionTimeoutMillis: 3500,
    application_name: 'synthetic_head_of_state_read_ci'
  });
  let client;
  try {
    client = await pool.connect();
    const info = (await client.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(info.db, 'political_consent_race_ci');
    assert.equal(Math.floor(info.version / 10000), 17);
    await client.query('BEGIN');

    await client.query('CREATE TEMP TABLE users(id uuid PRIMARY KEY, ruolo text, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents(user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE voti_capo_stato(userid uuid NOT NULL, nome text NOT NULL, timestamp timestamptz DEFAULT NOW())');
    const active = '00000000-0000-4000-8000-000000000278';
    const revoked = '00000000-0000-4000-8000-000000000279';
    await client.query("INSERT INTO users VALUES ($1,'E',true), ($2,'E',true)", [active, revoked]);
    await client.query('INSERT INTO user_consents VALUES ($1,true), ($2,false)', [active, revoked]);
    await client.query("INSERT INTO voti_capo_stato(userid,nome) VALUES ($1,'Synthetic Candidate'),($2,'Synthetic Candidate')", [active, revoked]);

    const full = fs.readFileSync(path.join(__dirname, '../routes/capo-stato.js'), 'utf8');
    const from = full.indexOf('// GET /api/capo-stato -');
    const to = full.indexOf('// Endpoint rimosso - duplicato', from);
    assert.ok(from >= 0 && to > from);
    let routeHandlers = null;
    const router = { get(name, ...handlers) {
      assert.equal(name, '/');
      routeHandlers = handlers;
    } };
    vm.runInNewContext(full.slice(from, to), {
      router, pool: { query: (...args) => client.query(...args) },
      jwt: { verify(token) {
        assert.equal(token, 'synthetic');
        return { userId: active };
      } },
      process: { env: { JWT_SECRET: 'synthetic-only' } },
      isIneligibleCandidate: () => false,
      getPreferenceCooldown: async () => ({ isBlocked: true, unlockDate: '2026-10-26T06:00:00Z' }),
      console: { log() {}, warn() {}, error() {} }
    }, { filename: 'capo-stato-read-ci.js' });
    assert.equal(routeHandlers.length, 2);

    async function read(authorization = null) {
      const res = {
        statusCode: 200, headers: {}, body: null,
        set(key, val) { this.headers[key.toLowerCase()] = val; return this; },
        status(value) { this.statusCode = value; return this; },
        json(obj) { this.body = obj; return this; }
      };
      const req = { headers: authorization ? { authorization } : {} };
      await routeHandlers[0](req, res, () => {});
      await routeHandlers[1](req, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.match(res.headers['cache-control'], /no-store/);
      return res.body;
    }

    let body = await read('Bearer synthetic');
    assert.equal(body.classifica.find(x => x.nome === 'Synthetic Candidate')?.voti, 1,
      'revoked residual ballot must be excluded from public aggregate');
    assert.deepEqual(Array.from(body.mieiVoti), ['Synthetic Candidate']);
    assert.equal(body.blocco.isBlocked, true);
    assert.equal(JSON.stringify(body).includes(revoked), false);

    body = await read();
    assert.equal(body.classifica.find(x => x.nome === 'Synthetic Candidate')?.voti, 1);
    assert.deepEqual(Array.from(body.mieiVoti), []);

    await client.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [active]);
    body = await read('Bearer synthetic');
    assert.deepEqual(Array.from(body.classifica), []);
    assert.deepEqual(Array.from(body.mieiVoti), []);
    assert.equal(body.blocco.isBlocked, false);
    console.log('PASS: PostgreSQL 17 synthetic head-of-state revoked ballots and private read');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
