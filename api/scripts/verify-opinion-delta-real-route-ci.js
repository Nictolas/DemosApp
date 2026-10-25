'use strict';

// PostgreSQL 17 integration proof for the REAL /api/opinioni/salva route,
// using only a disposable GitHub Actions database and TEMP session tables.
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Pool } = require('pg');

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
  for (const [k, v] of Object.entries(expected)) {
    if (process.env[k] !== v) throw Error('Refusing non-synthetic database: ' + k);
  }
  for (const k of ['DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL',
    'SUPABASE_SERVICE_ROLE_KEY','RENDER']) {
    if (process.env[k]) throw Error('Refusing production configuration: ' + k);
  }
}

async function main() {
  guard();
  const db = new Pool({
    host: '127.0.0.1', port: 5432,
    database: 'political_consent_race_ci', user: 'postgres',
    password: 'synthetic-only', max: 1, connectionTimeoutMillis: 3500,
    application_name: 'synthetic_real_opinion_delta'
  });
  let server = null;
  const userId = '00000000-0000-4000-8000-000000000312';
  const root = path.resolve(__dirname, '..');
  const paths = {
    route: require.resolve(path.join(root, 'routes/opinioni/user-answers.js')),
    auth: require.resolve(path.join(root, 'middleware/auth.js')),
    notifications: require.resolve(path.join(root, 'services/politicalOpinionNotificationService.js')),
    push: require.resolve(path.join(root, 'services/currentSupporterPushService.js'))
  };
  const saved = new Map(Object.values(paths).map(p => [p, require.cache[p]]));
  const install = (file, exports) => {
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
  };
  let updateStatements = [];
  try {
    const version = (await db.query(
      "SELECT current_database() AS name, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(version.name, 'political_consent_race_ci');
    assert.equal(Math.floor(version.version / 10000), 17);

    const columns = Array.from({ length: 94 }, (_, i) => 'q' + (i + 1));
    await db.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await db.query('CREATE TEMP TABLE user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await db.query('CREATE TEMP TABLE opinioni_risposte (user_id uuid PRIMARY KEY, ' +
      columns.map(c => '"' + c + '" text').join(', ') + ')');
    await db.query('INSERT INTO users VALUES ($1, true)', [userId]);
    await db.query('INSERT INTO user_consents VALUES ($1, true)', [userId]);
    const values = Object.fromEntries(columns.map(c => [c, 'f']));
    const params = [userId, ...columns.map(c => values[c])];
    await db.query(
      'INSERT INTO opinioni_risposte (user_id, ' + columns.join(', ') + ') ' +
      'VALUES (' + params.map((_, i) => '$' + (i + 1)).join(', ') + ')',
      params
    );

    // All pool handles refer to the one isolated PostgreSQL session, so TEMP
    // tables are visible during schema lookup and the transaction's FOR UPDATE.
    const observed = (sql, params) => {
      if (String(sql).replace(/\s+/g, ' ').trim().startsWith('UPDATE opinioni_risposte')) {
        updateStatements.push({ sql: String(sql), params });
      }
    };
    const apiPool = {
      async query(sql, params) {
        observed(sql, params);
        return db.query(sql, params);
      },
      async connect() {
        const client = await db.connect();
        return {
          async query(sql, params) {
            observed(sql, params);
            return client.query(sql, params);
          },
          release() { client.release(); }
        };
      }
    };
    install(paths.auth, {
      pool: apiPool,
      requireAdmin: (_req, res) => res.status(403).end(),
      verifyToken(req, res, next) {
        if (req.headers.authorization !== 'Bearer synthetic-delta-token') {
          return res.status(401).json({ success: false });
        }
        req.userId = userId;
        req.user = { id: userId, isAdmin: false, isPolitician: false, isCandidate: false };
        next();
      }
    });
    install(paths.notifications, {
      async createSupporterOpinionNotifications() {
        throw Error('Non-politician fixture must never notify supporters');
      }
    });
    install(paths.push, {
      async sendPushToCurrentSupporters() {
        throw Error('Non-politician fixture must never emit push');
      }
    });
    delete require.cache[paths.route];
    const app = express();
    app.use(express.json());
    app.use('/api/opinioni', require(paths.route));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    async function save(opinioni) {
      const response = await fetch(base + '/api/opinioni/salva', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer synthetic-delta-token'
        },
        body: JSON.stringify({ opinioni })
      });
      return { status: response.status, data: await response.json() };
    }
    async function stored() {
      return (await db.query(
        'SELECT xmin::text AS revision, q1, q79, q80, q81 FROM opinioni_risposte WHERE user_id=$1',
        [userId]
      )).rows[0];
    }

    const before = await stored();
    let result = await save(values);
    assert.equal(result.status, 200);
    assert.equal(result.data.savedCount, 94);
    assert.equal(updateStatements.length, 0, 'No UPDATE for identical answers');
    const afterNoop = await stored();
    assert.equal(afterNoop.revision, before.revision, 'PostgreSQL row version must not change');

    const oneChange = { ...values, q80: 'c' };
    result = await save(oneChange);
    assert.equal(result.status, 200);
    assert.equal(result.data.savedCount, 94);
    assert.equal(updateStatements.length, 1);
    assert.match(updateStatements[0].sql, /SET "q80" = \$1\s+WHERE user_id = \$2/);
    assert.deepEqual(updateStatements[0].params, ['c', userId]);
    const afterOne = await stored();
    assert.equal(afterOne.q80, 'c');
    assert.equal(afterOne.q79, 'f');
    assert.equal(afterOne.q81, 'f');
    assert.notEqual(afterOne.revision, before.revision);

    // New single-field opinion update: do not retransmit/write the other 93.
    result = await save({ q1: 'c', q80: 'c' });
    assert.equal(result.status, 200);
    assert.equal(result.data.savedCount, 2);
    assert.equal(updateStatements.length, 2);
    assert.match(updateStatements[1].sql, /SET "q1" = \$1\s+WHERE user_id = \$2/);
    assert.equal((await stored()).q1, 'c');

    await db.query(
      'UPDATE user_consents SET political_opinions_consent = false WHERE user_id=$1',
      [userId]
    );
    const revokedBefore = await stored();
    result = await save({ q1: 'c', q80: 'c' });
    assert.equal(result.status, 403);
    assert.equal(result.data.consent_required, true);
    assert.equal(updateStatements.length, 2, 'Revocation must prevent even no-op writes');
    assert.deepEqual(await stored(), revokedBefore);

    console.log('OPINION_DELTA_REAL_ROUTE_PG17_SYNTHETIC_PASS');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [file, previous] of saved) {
      if (previous) require.cache[file] = previous;
      else delete require.cache[file];
    }
    await db.end();
  }
}

main().catch(error => {
  console.error('OPINION_DELTA_REAL_ROUTE_PG17_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
