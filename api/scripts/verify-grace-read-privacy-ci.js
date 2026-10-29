'use strict';

// PostgreSQL 17 real-query verification, synthetic fixture only.
// Never use DATABASE_URL or connect to production/Supabase/Render.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Pool } = require('pg');

function guard() {
  const safe = process.env.GITHUB_ACTIONS === 'true'
    && process.env.POLITICAL_CONSENT_RACE_CI === 'synthetic'
    && process.env.PGHOST === '127.0.0.1'
    && process.env.PGPORT === '5432'
    && process.env.PGDATABASE === 'political_consent_race_ci'
    && process.env.PGUSER === 'postgres'
    && process.env.PGPASSWORD === 'synthetic-only';
  if (!safe) throw new Error('Synthetic-only CI guard refused database connection');
}

async function main() {
  guard();
  const db = new Pool({
    host: '127.0.0.1', port: 5432, database: 'political_consent_race_ci',
    user: 'postgres', password: 'synthetic-only', max: 1,
    application_name: 'synthetic_grace_read_ci', connectionTimeoutMillis: 3500
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
    // TEMP tables are scoped to this one PostgreSQL connection and rolled back.
    await client.query('CREATE TEMP TABLE users(id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents(user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE voti_grazia(userid uuid NOT NULL, nome text NOT NULL, timestamp timestamptz DEFAULT now())');
    await client.query('CREATE TEMP TABLE grazia_carcerati(nome text NOT NULL, attivo boolean NOT NULL)');
    const active = '00000000-0000-4000-8000-000000000276';
    const revoked = '00000000-0000-4000-8000-000000000277';
    await client.query('INSERT INTO users VALUES($1,true),($2,true)', [active, revoked]);
    await client.query('INSERT INTO user_consents VALUES($1,true),($2,false)', [active, revoked]);
    await client.query("INSERT INTO voti_grazia(userid,nome) VALUES($1,'Test only'),($2,'Test only')", [active, revoked]);
    await client.query("INSERT INTO grazia_carcerati VALUES('Test only',true)");

    const source = fs.readFileSync(path.join(__dirname, '../routes/grazia.js'), 'utf8');
    const start = source.indexOf('// GET /api/grazia -');
    const end = source.indexOf('// GET /api/grazia/richieste -', start);
    assert.ok(start >= 0 && end > start);
    let handlers;
    const router = { get(route, ...fns) {
      assert.equal(route, '/');
      handlers = fns;
    } };
    const dbView = { query: (sql, params) => client.query(sql, params) };
    vm.runInNewContext(source.slice(start, end), {
      router, pool: dbView,
      process: { env: { JWT_SECRET: 'synthetic-only' } },
      require: name => {
        assert.equal(name, 'jsonwebtoken');
        return { verify(token) {
          assert.equal(token, 'synthetic');
          return { userId: active };
        } };
      },
      getPreferenceCooldown: async () => ({ isBlocked: false, unlockDate: null }),
      console: { log() {}, warn() {}, error() {} }
    });
    assert.equal(handlers.length, 2);

    async function request(authorization) {
      const response = {
        statusCode: 200, headers: {}, body: null,
        set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
      };
      const req = { headers: authorization ? { authorization } : {} };
      await handlers[0](req, response, () => {});
      await handlers[1](req, response);
      assert.match(response.headers['cache-control'], /no-store/);
      assert.equal(response.statusCode, 200);
      assert.equal(Array.from(response.body.richieste).length, 0);
      return response.body;
    }

    let data = await request('Bearer synthetic');
    assert.deepEqual(Array.from(data.mieiVoti), ['Test only']);
    assert.equal(data.classifica.find(x => x.nome === 'Test only').richieste, 1,
      'revoked residual ballot must be excluded from public count');
    assert.equal(JSON.stringify(data).includes(revoked), false);
    data = await request();
    assert.equal(Array.from(data.mieiVoti).length, 0);
    assert.equal(data.classifica.find(x => x.nome === 'Test only').richieste, 1);

    await client.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [active]);
    data = await request('Bearer synthetic');
    assert.equal(Array.from(data.mieiVoti).length, 0);
    assert.equal(data.classifica.find(x => x.nome === 'Test only').richieste, 0);
    assert.equal(data.blocco.isBlocked, false);
    console.log('PASS: Grazia PostgreSQL 17 synthetic public, personal, revoked and cache paths');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await db.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
