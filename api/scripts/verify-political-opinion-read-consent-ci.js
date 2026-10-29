'use strict';

/**
 * PostgreSQL 17 + actual Express GET /api/opinioni-list, synthetic-only.
 * Verifies the SQL consent predicate filters residual political answers.
 * Never connects to Supabase, Render or any production database.
 */
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { Pool } = require('pg');

const DB = 'political_consent_race_ci';
const ID = '00000000-0000-4000-8000-000000000268';
const TARGET_ID = '00000000-0000-4000-8000-000000000270';
const { getOpinionMapsByUserId, buildPoliticalMatches } = require('../services/politicalMatchingService');

function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.POLITICAL_CONSENT_RACE_CI !== 'synthetic' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== DB || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only' ||
      e.DATABASE_URL || e.SUPABASE_URL || e.SUPABASE_DB_URL ||
      e.SUPABASE_SERVICE_ROLE_KEY || e.RENDER) {
    throw Error('Refusing non-local synthetic PostgreSQL');
  }
}

async function main() {
  guard();
  const pool = new Pool({
    host: '127.0.0.1', port: 5432, database: DB,
    user: 'postgres', password: 'synthetic-only', max: 1,
    statement_timeout: 8000, connectionTimeoutMillis: 3500,
    application_name: 'synthetic_political_read_consent'
  });
  const client = await pool.connect();
  const authPath = require.resolve('../middleware/auth');
  const jwtPath = require.resolve('../utils/jwt');
  const routePath = require.resolve('../routes/compatibility');
  const paths = [authPath, jwtPath, routePath];
  const previous = new Map(paths.map(p => [p, require.cache[p]]));
  const oldNodeEnv = process.env.NODE_ENV;
  let server;
  try {
    const v = (await client.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::int AS v"
    )).rows[0];
    assert.equal(v.db, DB);
    assert.equal(Math.floor(v.v / 10000), 17);

    // TEMP tables shadow any permanent fixtures and disappear on disconnect.
    await client.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, status text, ruolo text, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE opinioni_domande (id text PRIMARY KEY, text text, gradi_opinione text[])');
    await client.query('CREATE TEMP TABLE opinioni_risposte (user_id uuid PRIMARY KEY, caccia text)');
    await client.query("INSERT INTO users VALUES ($1, 'a', 'c', true)", [ID]);
    await client.query('INSERT INTO user_consents VALUES ($1, true)', [ID]);
    await client.query("INSERT INTO opinioni_domande VALUES ('caccia', 'Synthetic question', ARRAY['N'])");
    await client.query("INSERT INTO opinioni_risposte VALUES ($1, 'f')", [ID]);

    require.cache[authPath] = {
      id: authPath, filename: authPath, loaded: true,
      exports: { pool: { query: (...args) => client.query(...args) } }
    };
    require.cache[jwtPath] = {
      id: jwtPath, filename: jwtPath, loaded: true,
      exports: { verifyAccessToken: token => {
        if (token !== 'synthetic') throw Error('Invalid synthetic token');
        return { userId: ID };
      } }
    };
    delete require.cache[routePath];
    process.env.NODE_ENV = 'production';
    const router = require(routePath);
    const app = express();
    app.use('/api', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port + '/api/opinioni-list?grado=N';

    async function read(expectedStatus = 200) {
      const res = await fetch(url, { headers: { authorization: 'Bearer synthetic' } });
      assert.equal(res.status, expectedStatus);
      assert.match(res.headers.get('cache-control') || '', /no-store/);
      return (await res.json()).data[0];
    }

    // Positive case: granted consent and persisted answer.
    assert.equal((await read()).userAnswer, 'f');
    // Revocation override takes precedence even when the legacy flag is true.
    await client.query('UPDATE user_consents SET political_opinions_consent = false WHERE user_id = $1', [ID]);
    assert.equal((await read()).userAnswer, null);
    // No override + legacy false also refuses a residual answer.
    await client.query('UPDATE users SET political_opinions_consent = false WHERE id = $1', [ID]);
    await client.query('UPDATE user_consents SET political_opinions_consent = NULL WHERE user_id = $1', [ID]);
    assert.equal((await read()).userAnswer, null);
    // Explicit current override true is authoritative.
    await client.query('UPDATE user_consents SET political_opinions_consent = true WHERE user_id = $1', [ID]);
    assert.equal((await read()).userAnswer, 'f');

    const unauthorized = await fetch(url);
    assert.equal(unauthorized.status, 401);
    assert.match(unauthorized.headers.get('cache-control') || '', /no-store/);

    // The same real PostgreSQL 17 fixture verifies the shared matching engine.
    // Both caller and candidate rows may survive a revocation: neither can
    // influence the score or completion unless their own consent is active.
    await client.query("INSERT INTO users VALUES ($1, 'a', 'c', true)", [TARGET_ID]);
    await client.query('INSERT INTO user_consents VALUES ($1, true)', [TARGET_ID]);
    await client.query("INSERT INTO opinioni_risposte VALUES ($1, 'c')", [TARGET_ID]);
    const candidates = [{ id: TARGET_ID, nome: 'Synthetic', cognome: 'Candidate' }];
    const maps = () => getOpinionMapsByUserId(client, [ID, TARGET_ID], ['caccia']);
    const match = () => buildPoliticalMatches({ pool: client, userId: ID, subjects: candidates, grade: 'N' });

    assert.deepEqual((await maps()).get(TARGET_ID), { caccia: 'c' });
    assert.equal((await match()).matches[0].copertura_posizioni, 1);

    // A candidate's revoked override suppresses even residual answers.
    await client.query('UPDATE user_consents SET political_opinions_consent = false WHERE user_id = $1', [TARGET_ID]);
    assert.deepEqual((await maps()).get(TARGET_ID), {});
    const revokedCandidate = await match();
    assert.equal(revokedCandidate.matches[0].copertura_posizioni, 0);
    assert.equal(revokedCandidate.matches[0].matching_score, 0);

    // A caller's revoked override suppresses their own completion and matches.
    await client.query('UPDATE user_consents SET political_opinions_consent = false WHERE user_id = $1', [ID]);
    const revokedCaller = await match();
    assert.equal(revokedCaller.isComplete, false);
    assert.deepEqual(revokedCaller.userAnswers, {});
    assert.deepEqual(revokedCaller.matches, []);

    // Missing override falls back to the legacy false flag (fail-closed).
    await client.query('UPDATE users SET political_opinions_consent = false WHERE id = $1', [TARGET_ID]);
    await client.query('UPDATE user_consents SET political_opinions_consent = NULL WHERE user_id = $1', [TARGET_ID]);
    assert.deepEqual((await maps()).get(TARGET_ID), {});

    // Explicit override true is authoritative, even if legacy is false.
    await client.query('UPDATE user_consents SET political_opinions_consent = true WHERE user_id = $1', [TARGET_ID]);
    assert.deepEqual((await maps()).get(TARGET_ID), { caccia: 'c' });
    console.log('POLITICAL_MATCHING_CONSENT_REAL_PG17_PASS');

    console.log('POLITICAL_OPINION_READ_CONSENT_REAL_PG17_PASS');
    console.log('POLITICAL_OPINION_READ_CONSENT_RESULT_JSON=' + JSON.stringify({
      postgres: 17, fixture: 'temporary-synthetic-only',
      cases: ['granted', 'revoked-override', 'missing-consent', 'granted-override', 'unauthorized'],
      unauthorizedPersonalAnswers: 0, matchingConsentCases: ['granted', 'candidate-revoked', 'caller-revoked', 'legacy-false', 'explicit-override'], productionUntouched: true
    }));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [p, original] of previous) {
      if (original) require.cache[p] = original;
      else delete require.cache[p];
    }
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    client.release();
    await pool.end();
  }
}
main().catch(error => {
  console.error('SYNTHETIC_POLITICAL_READ_CONSENT_FAIL', error);
  process.exitCode = 1;
});
