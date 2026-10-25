'use strict';

// Only synthetic PostgreSQL 17 on an ephemeral GitHub Actions instance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Pool } = require('pg');
const { getPoliticalConsentState } = require('../services/politicalConsentService');
const { loadPoliticalSelections, selectionsByOffice } = require('../services/politicalSelectionService');
const { getLegacySelectionDescriptors } = require('../services/politicalJurisdictionRegistryService');

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
    if (process.env[key] !== value) throw Error('Refusing non-synthetic environment: ' + key);
  }
  for (const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL',
    'SUPABASE_SERVICE_ROLE_KEY','RENDER']) {
    if (process.env[key]) throw Error('Production database credentials are forbidden: ' + key);
  }
}

async function main() {
  guard();
  const db = new Pool({
    host: '127.0.0.1', port: 5432, database: 'political_consent_race_ci',
    user: 'postgres', password: 'synthetic-only',
    max: 1, connectionTimeoutMillis: 3500,
    application_name: 'synthetic_personal_selection_read'
  });
  let client;
  try {
    client = await db.connect();
    const info = (await client.query(
      "SELECT current_database() AS name, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(info.name, 'political_consent_race_ci');
    assert.equal(Math.floor(info.version / 10000), 17);
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query(
      'CREATE TEMP TABLE political_selections (' +
      'user_id uuid NOT NULL, selection_kind text NOT NULL,' +
      'jurisdiction_id text, political_office_id text,' +
      'selected_user_id uuid, selected_candidacy_id uuid, selected_mandate_id uuid,' +
      'source text, context jsonb DEFAULT \'{}\'::jsonb, updated_at timestamptz DEFAULT NOW())'
    );

    const active = '00000000-0000-4000-8000-000000000296';
    const revoked = '00000000-0000-4000-8000-000000000297';
    const chosen = '00000000-0000-4000-8000-000000000298';
    await client.query('INSERT INTO users VALUES ($1,true),($2,true)', [active, revoked]);
    await client.query('INSERT INTO user_consents VALUES ($1,true),($2,false)', [active, revoked]);
    for (const userId of [active, revoked]) {
      for (const kind of ['candidate', 'representative']) {
        await client.query(
          'INSERT INTO political_selections (' +
          'user_id, selection_kind, jurisdiction_id, political_office_id,' +
          'selected_user_id, source, context) ' +
          'VALUES ($1, $2, \'it\', \'it.camera\', $3, \'matching\', \'{}\'::jsonb)',
          [userId, kind, chosen]
        );
      }
    }

    const pool = { query: (...args) => client.query(...args) };
    const cases = [
      {
        path: '../routes/candidati.js',
        start: 'function emptyCandidateSelectionProjection()',
        end: '// GET /api/candidati -',
        functionName: 'loadCandidateSelectionProjection',
        descriptorsName: 'CANDIDATE_SELECTION_DESCRIPTORS',
        kind: 'candidate',
        field: 'candidato_camera'
      },
      {
        path: '../routes/rappresentanti.js',
        start: 'function emptyRepresentativeSelectionProjection()',
        end: '// GET /api/rappresentanti/disponibili',
        functionName: 'loadRepresentativeSelectionProjection',
        descriptorsName: 'REPRESENTATIVE_SELECTION_DESCRIPTORS',
        kind: 'representative',
        field: 'rappresentante_camera'
      }
    ];

    for (const c of cases) {
      const source = fs.readFileSync(path.join(__dirname, c.path), 'utf8');
      const start = source.indexOf(c.start);
      const end = source.indexOf(c.end, start);
      assert.ok(start >= 0 && end > start, c.path + ' helper missing');
      const context = {
        pool, getPoliticalConsentState, loadPoliticalSelections,
        selectionsByOffice,
        [c.descriptorsName]: getLegacySelectionDescriptors(c.kind),
        Object
      };
      vm.runInNewContext(
        source.slice(start, end) + '\nthis.loadProjection = ' + c.functionName + ';',
        context
      );

      let result = await context.loadProjection(active);
      assert.equal(result.projection[c.field], chosen, c.kind + ' active selection');
      result = await context.loadProjection(revoked);
      assert.equal(result.projection[c.field], null, c.kind + ' residual revoked selection');
      assert.equal(result.state.selections.length, 0);
      // Keep the ballot row after revocation: reads must still be suppressed.
      await client.query(
        'UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1',
        [active]
      );
      result = await context.loadProjection(active);
      assert.equal(result.projection[c.field], null, c.kind + ' post-revoke');
      await client.query(
        'UPDATE user_consents SET political_opinions_consent=true WHERE user_id=$1',
        [active]
      );
    }
    console.log('PERSONAL_SELECTION_READ_REVOKE_PG17_SYNTHETIC_PASS');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await db.end();
  }
}

main().catch(error => {
  console.error('PERSONAL_SELECTION_READ_PG17_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
