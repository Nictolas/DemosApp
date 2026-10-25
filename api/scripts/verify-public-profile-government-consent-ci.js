'use strict';

// Synthetic PostgreSQL 17 proof of actual public-profile ideal-government SQL.
// Guard prevents connections to Supabase/Render or any non-CI database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Pool } = require('pg');

function guardEnvironment() {
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
    if (process.env[key] !== value) {
      throw Error('Refusing non-synthetic database environment: ' + key);
    }
  }
  for (const key of [
    'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_DB_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 'RENDER'
  ]) {
    if (process.env[key]) throw Error('Refusing production credentials: ' + key);
  }
}

async function main() {
  guardEnvironment();
  const pool = new Pool({
    host: '127.0.0.1', port: 5432,
    database: 'political_consent_race_ci',
    user: 'postgres', password: 'synthetic-only',
    connectionTimeoutMillis: 3500, max: 1,
    application_name: 'synthetic_public_profile_government_read'
  });
  let client;
  try {
    client = await pool.connect();
    const meta = (await client.query(
      "SELECT current_database() AS name, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(meta.name, 'political_consent_race_ci');
    assert.equal(Math.floor(meta.version / 10000), 17);

    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE voti_difesa (userid uuid, nome_display text, timestamp timestamptz DEFAULT NOW())');
    await client.query('CREATE TEMP TABLE voti_esteri (userid uuid, nome_display text, timestamp timestamptz DEFAULT NOW())');

    const active = '00000000-0000-4000-8000-000000000293';
    const revoked = '00000000-0000-4000-8000-000000000294';
    await client.query('INSERT INTO users VALUES ($1,true),($2,true)', [active, revoked]);
    await client.query('INSERT INTO user_consents VALUES ($1,true),($2,false)', [active, revoked]);
    await client.query("INSERT INTO voti_difesa (userid,nome_display) VALUES ($1,'Synthetic Active Minister'),($2,'Synthetic Revoked Minister')", [active, revoked]);
    await client.query("INSERT INTO voti_esteri (userid,nome_display) VALUES ($1,'Synthetic Foreign Minister')", [active]);

    const source = fs.readFileSync(path.join(__dirname, '../routes/users/public-profile.js'), 'utf8');
    const start = source.indexOf('async function loadIdealGovernment(userId) {');
    const end = source.indexOf('// Proiezione pubblica minima', start);
    assert.ok(start >= 0 && end > start, 'Government projection helper missing');

    const { getPoliticalConsentState } = require('../services/politicalConsentService');
    // The fixture uses one long-lived transaction to keep its tables TEMP.
    // Real pool.query calls are independent autocommit statements. Savepoints
    // reproduce that error isolation when a legacy ministry table is missing:
    // otherwise PostgreSQL would abort the whole test transaction on 42P01.
    const tempPool = {
      async query(sql, params) {
        await client.query('SAVEPOINT synthetic_read');
        try {
          const result = await client.query(sql, params);
          await client.query('RELEASE SAVEPOINT synthetic_read');
          return result;
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT synthetic_read');
          await client.query('RELEASE SAVEPOINT synthetic_read');
          throw error;
        }
      }
    };
    const context = {
      pool: tempPool,
      MINISTRIES: ['difesa','esteri','cultura'],
      getPoliticalConsentState,
      Object
    };
    // Use the exact helper from production, not a copied SQL approximation.
    vm.runInNewContext(source.slice(start, end) + '\nthis.readIdeal = loadIdealGovernment;', context);
    assert.equal(typeof context.readIdeal, 'function');

    let data = await context.readIdeal(active);
    assert.equal(data.difesa, 'Synthetic Active Minister');
    assert.equal(data.esteri, 'Synthetic Foreign Minister');
    assert.equal(data.cultura, undefined, 'Legacy missing ministry table should be ignored');
    assert.equal(JSON.stringify(data).includes('Synthetic Revoked Minister'), false);

    data = await context.readIdeal(revoked);
    assert.deepEqual(Object.keys(data), [], 'Revoked consent must suppress all personal minister reads');

    // Keep the vote row in place: query consent gate must still protect it.
    await client.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [active]);
    data = await context.readIdeal(active);
    assert.deepEqual(Object.keys(data), [], 'Residual ballot after revocation must never appear');

    // A missing per-purpose consent row falls back to the user's legacy
    // consent column, preserving the existing schema-compatibility policy.
    await client.query('DELETE FROM user_consents WHERE user_id=$1', [active]);
    data = await context.readIdeal(active);
    assert.equal(data.difesa, 'Synthetic Active Minister');

    console.log('PUBLIC_PROFILE_GOVERNMENT_CONSENT_PG17_SYNTHETIC_PASS');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await pool.end();
  }
}

main().catch(error => {
  console.error('PUBLIC_PROFILE_GOVERNMENT_PG17_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
