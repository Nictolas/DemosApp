'use strict';

// Execute actual Government minister GET SQL on PostgreSQL 17 local CI only.
// Synthetic temporary fixtures; one transaction is rolled back on completion.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Pool } = require('pg');

const ministries = [
  'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno',
  'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente',
  'ambiente_sicurezza_energetica', 'cultura', 'sport'
];

function guard() {
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
    if (process.env[key] !== value) throw Error('Synthetic CI guard refused: ' + key);
  }
  for (const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY','RENDER']) {
    if (process.env[key]) throw Error('Production environment forbidden: ' + key);
  }
}

async function main() {
  guard();
  const db = new Pool({
    host: '127.0.0.1', port: 5432,
    database: 'political_consent_race_ci', user: 'postgres',
    password: 'synthetic-only', max: 1, connectionTimeoutMillis: 3500,
    application_name: 'synthetic_government_ministry_read'
  });
  let client;
  try {
    client = await db.connect();
    const info = (await client.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(info.db, 'political_consent_race_ci');
    assert.equal(Math.floor(info.version / 10000), 17);
    await client.query('BEGIN');
    // Canonical consent reads use public; prior synthetic race drills may
    // already have created these relations in this disposable PG17 database.
    // Every fixture write here is enclosed by the outer ROLLBACK transaction.
    await client.query('CREATE TABLE IF NOT EXISTS public.users ' +
      '(id uuid PRIMARY KEY,political_opinions_consent boolean)');
    await client.query('CREATE TABLE IF NOT EXISTS public.user_consents ' +
      '(user_id uuid PRIMARY KEY,political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    for (const ministry of ministries) {
      // SQL identifiers originate only from the fixed test allowlist above.
      await client.query(
        'CREATE TEMP TABLE voti_' + ministry +
        ' (userid uuid NOT NULL, nome_display text NOT NULL, timestamp timestamptz DEFAULT NOW())'
      );
    }
    const active = '00000000-0000-4000-8000-000000000290';
    const revoked = '00000000-0000-4000-8000-000000000291';
    await client.query('INSERT INTO users VALUES ($1,true),($2,true)', [active, revoked]);
    await client.query('INSERT INTO user_consents VALUES ($1,true),($2,false)', [active, revoked]);
    await client.query(
      'INSERT INTO public.users(id,political_opinions_consent) ' +
      'VALUES ($1,true),($2,true) ON CONFLICT (id) ' +
      'DO UPDATE SET political_opinions_consent=EXCLUDED.political_opinions_consent',
      [active,revoked]
    );
    await client.query(
      'INSERT INTO public.user_consents(user_id,political_opinions_consent) ' +
      'VALUES ($1,true),($2,false) ON CONFLICT (user_id) ' +
      'DO UPDATE SET political_opinions_consent=EXCLUDED.political_opinions_consent',
      [active,revoked]
    );
    await client.query("INSERT INTO voti_difesa(userid,nome_display) VALUES($1,'Synthetic Active'),($2,'Synthetic Revoked')", [active, revoked]);
    await client.query("INSERT INTO voti_esteri(userid,nome_display) VALUES($1,'Synthetic Foreign')", [active]);

    const full = fs.readFileSync(path.join(__dirname, '../routes/governo.js'), 'utf8');
    const startVoti = full.indexOf('// GET /api/governo/voti -');
    const endVoti = full.indexOf('// POST /api/governo/vota -', startVoti);
    const startIdeale = full.indexOf('// GET /api/governo/ideale -');
    const endIdeale = full.indexOf('// POST /api/governo - Aggiungi membro governo', startIdeale);
    assert.ok(startVoti >= 0 && endVoti > startVoti && startIdeale > endVoti && endIdeale > startIdeale);

    const handlers = new Map();
    const router = { get(name, ...fns) { handlers.set(name, fns); } };
    const { getPoliticalConsentState } = require('../services/politicalConsentService');
    const pool = { query: (...args) => client.query(...args) };
    const passthrough = (req, res, next) => {
      if (req.headers.authorization === 'Bearer active') req.userId = active;
      else if (req.headers.authorization === 'Bearer revoked') req.userId = revoked;
      else return res.status(401).json({ success: false });
      req.user = { id: req.userId, isAdmin: false };
      return next();
    };
    const context = {
      router, pool, verifyToken: passthrough, getPoliticalConsentState,
      getPreferenceCooldown: async () => ({ isBlocked: false, unlockDate: null }),
      console: { log() {}, warn() {}, error() {} }, Number, Object
    };
    vm.runInNewContext(full.slice(startVoti, endVoti), context, { filename: 'government-ministry-voti-read.js' });
    vm.runInNewContext(full.slice(startIdeale, endIdeale), context, { filename: 'government-ministry-ideale-read.js' });
    assert.equal(handlers.get('/voti')?.length, 3);
    assert.equal(handlers.get('/ideale')?.length, 3);

    async function request(url, auth) {
      const req = { headers: auth ? { authorization: 'Bearer ' + auth } : {} };
      const res = {
        statusCode: 200, headers: {}, body: null,
        set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        status(v) { this.statusCode = v; return this; },
        json(body) { this.body = body; return this; }
      };
      for (const handler of handlers.get(url)) {
        let proceeded = false;
        await handler(req, res, () => { proceeded = true; });
        if (!proceeded) break;
      }
      assert.match(res.headers['cache-control'] || '', /private/);
      assert.match(res.headers['cache-control'] || '', /no-store/);
      return res;
    }

    let result = await request('/voti','active');
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.classifiche.difesa.map(v => v.nome), ['Synthetic Active'],
      'Revoked residual ballot must not enter public minister rankings');
    assert.equal(result.body.classifiche.difesa[0].voti, 1);
    assert.equal(result.body.mieiVoti.difesa, 'Synthetic Active');
    assert.equal(result.body.mieiVoti.esteri, 'Synthetic Foreign');
    assert.equal(JSON.stringify(result.body).includes('Synthetic Revoked'), false);

    result = await request('/ideale','active');
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data.difesa, 'Synthetic Active');
    assert.equal(result.body.data.esteri, 'Synthetic Foreign');

    result = await request('/voti','revoked');
    assert.equal(result.statusCode, 200);
    assert.equal(Object.keys(result.body.mieiVoti).length, 0);
    assert.equal(result.body.blocchi.difesa.isBlocked, false);
    assert.deepEqual(result.body.classifiche.difesa.map(v => v.nome), ['Synthetic Active']);
    result = await request('/ideale','revoked');
    assert.equal(result.statusCode, 200);
    assert.equal(Object.keys(result.body.data).length, 0);

    result = await request('/voti');
    assert.equal(result.statusCode, 401);
    result = await request('/ideale');
    assert.equal(result.statusCode, 401);

    // Deliberately retain ballots after consent revocation to test query gates.
    await client.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [active]);
    await client.query('UPDATE public.user_consents SET political_opinions_consent=false WHERE user_id=$1', [active]);
    result = await request('/voti','active');
    assert.equal(result.statusCode, 200);
    assert.equal(Object.keys(result.body.mieiVoti).length, 0);
    assert.equal(result.body.classifiche.difesa.length, 0);
    assert.equal(result.body.blocco.isBlocked, false);
    result = await request('/ideale','active');
    assert.equal(result.statusCode, 200);
    assert.equal(Object.keys(result.body.data).length, 0);

    console.log('GOVERNMENT_MINISTRY_READ_PG17_SYNTHETIC_PASS');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await db.end();
  }
}

main().catch(error => {
  console.error('GOVERNMENT_MINISTRY_READ_PG17_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
