'use strict';

// Ephemeral PostgreSQL 17 proof of the actual consent service + legacy rows.
// Never connects to Supabase, Render or a non-CI database.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { getPoliticalConsentState } = require('../services/politicalConsentService');
const {
  PERSONAL_SELECTION_FIELDS,
  maskPoliticalSelectionsWithoutConsent
} = require('../services/personalPoliticalSelectionVisibilityService');

function requireSyntheticCI() {
  const expected = {
    GITHUB_ACTIONS: 'true',
    POLITICAL_CONSENT_RACE_CI: 'synthetic',
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: 'political_consent_race_ci',
    PGUSER: 'postgres',
    PGPASSWORD: 'synthetic-only'
  };
  for (const [name, value] of Object.entries(expected))
    if (process.env[name] !== value) throw Error('Synthetic CI guard denied: ' + name);
  for (const name of [
    'DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL',
    'SUPABASE_SERVICE_ROLE_KEY','RENDER'
  ])
    if (process.env[name]) throw Error('Production configuration forbidden: ' + name);
}

async function main() {
  requireSyntheticCI();
  const db = new Pool({
    host: '127.0.0.1', port: 5432,
    database: 'political_consent_race_ci', user: 'postgres',
    password: 'synthetic-only', max: 1,
    connectionTimeoutMillis: 3500,
    application_name: 'synthetic_own_profile_selection_visibility'
  });
  let client;
  try {
    client = await db.connect();
    const info = (await client.query(
      "SELECT current_database() AS name, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(info.name, 'political_consent_race_ci');
    assert.equal(Math.floor(info.version / 10000), 17);
    assert.equal(PERSONAL_SELECTION_FIELDS.length, 10);

    await client.query('BEGIN');
    const columns = PERSONAL_SELECTION_FIELDS.map(field => field + ' text').join(', ');
    await client.query(
      'CREATE TEMP TABLE users (' +
      'id uuid PRIMARY KEY, nome text, ruolo text, political_opinions_consent boolean, ' + columns + ')'
    );
    await client.query('CREATE TEMP TABLE user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_representatives (user_id uuid PRIMARY KEY, ' + columns + ')');

    const active = '00000000-0000-4000-8000-000000000301';
    const revoked = '00000000-0000-4000-8000-000000000302';
    const fallback = '00000000-0000-4000-8000-000000000303';
    const chosen = 'synthetic-private-candidate';
    await client.query(
      'INSERT INTO users (id,nome,ruolo,political_opinions_consent,candidato_camera) ' +
      'VALUES ($1,\'Synthetic\',\'E\',true,$4),' +
      '($2,\'Synthetic\',\'E\',true,$4),' +
      '($3,\'Synthetic\',\'E\',true,$4)',
      [active,revoked,fallback,chosen]
    );
    await client.query(
      'INSERT INTO user_consents VALUES ($1,true),($2,false)', [active,revoked]
    );
    await client.query(
      'INSERT INTO user_representatives (user_id,candidato_camera,rappresentante_camera) ' +
      'VALUES ($1,$3,$3),($2,$3,$3),($4,$3,$3)',
      [active,revoked,chosen,fallback]
    );

    const pool = { query: (sql, params) => client.query(sql, params) };
    for (const [id, visible] of [[active,true],[revoked,false],[fallback,true]]) {
      const result = await client.query(
        'SELECT u.id, u.nome, u.ruolo, ' +
        PERSONAL_SELECTION_FIELDS.map(field =>
          'COALESCE(ur.' + field + ',u.' + field + ') AS ' + field
        ).join(', ') +
        ' FROM users u LEFT JOIN user_representatives ur ON ur.user_id=u.id WHERE u.id=$1',
        [id]
      );
      const raw = result.rows[0];
      assert.equal(raw.candidato_camera, chosen);
      assert.equal(raw.rappresentante_camera, chosen);

      const state = await getPoliticalConsentState(pool, id);
      assert.equal(state.granted, visible);
      const safe = maskPoliticalSelectionsWithoutConsent(raw, state.granted);
      for (const field of PERSONAL_SELECTION_FIELDS)
        if (visible) assert.equal(safe[field], raw[field]);
        else assert.equal(safe[field], null);
      assert.equal(safe.nome, 'Synthetic');
      assert.equal(safe.ruolo, 'E');
    }

    // A completed revocation must mask selections still physically present.
    await client.query(
      'UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1',
      [active]
    );
    const stillStored = (await client.query(
      'SELECT candidato_camera FROM user_representatives WHERE user_id=$1',
      [active]
    )).rows[0];
    assert.equal(stillStored.candidato_camera, chosen);
    const after = await getPoliticalConsentState(pool, active);
    assert.equal(after.granted, false);
    const safe = maskPoliticalSelectionsWithoutConsent(stillStored, after.granted);
    assert.equal(safe.candidato_camera, null);

    console.log('OWN_PROFILE_SELECTION_CONSENT_PG17_SYNTHETIC_PASS');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await db.end();
  }
}

main().catch(error => {
  console.error('OWN_PROFILE_SELECTION_CONSENT_PG17_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
