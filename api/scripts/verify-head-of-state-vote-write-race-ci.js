'use strict';

// Real HTTP + PostgreSQL 17 concurrency proof using synthetic data ONLY.
// Never use Supabase/Render credentials or database URLs from environment.
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { Pool } = require('pg');

const ID = '00000000-0000-4000-8000-000000000280';
const DB = 'political_consent_race_ci';
const gate = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { resolve, promise };
};
const timeout = (promise, ms = 9000) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error('Synthetic concurrency timeout')), ms))]);

function guard() {
  const e = process.env;
  const expected = {
    GITHUB_ACTIONS: 'true',
    POLITICAL_CONSENT_RACE_CI: 'synthetic',
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: DB,
    PGUSER: 'postgres',
    PGPASSWORD: 'synthetic-only'
  };
  for (const [key, value] of Object.entries(expected)) {
    if (e[key] !== value) throw Error('Synthetic-only DB guard failed: ' + key);
  }
}

async function main() {
  guard();
  const real = new Pool({
    host: '127.0.0.1', port: 5432, database: DB,
    user: 'postgres', password: 'synthetic-only',
    max: 5, connectionTimeoutMillis: 3500, statement_timeout: 8000,
    application_name: 'synthetic_head_of_state_vote_race'
  });
  let server, hold = null;
  const pool = {
    query: (...args) => real.query(...args),
    async connect() {
      const c = await real.connect();
      return {
        async query(sql, params) {
          const q = String(sql).replace(/\s+/g, ' ').trim();
          if (hold?.phase === 'revoke' && q === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
            hold.contender.resolve(); // POST has reached the conflicting statement.
          }
          const result = await c.query(sql, params);
          if (hold?.phase === 'save' && !hold.paused && q === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
            hold.paused = true;
            hold.locked.resolve(); // POST owns the row lock.
            await timeout(hold.resume.promise);
          }
          return result;
        },
        release(destroy) { c.release(destroy); }
      };
    }
  };
  const modulePaths = [
    require.resolve('../middleware/auth'),
    require.resolve('../middleware/civicIdentity'),
    require.resolve('../middleware/politicalConsent'),
    require.resolve('../config/database'),
    require.resolve('../services/preferenceCooldownService'),
    require.resolve('../routes/capo-stato')
  ];
  const originals = new Map(modulePaths.map(p => [p, require.cache[p]]));
  try {
    const info = (await real.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::int AS version"
    )).rows[0];
    assert.equal(info.db, DB);
    assert.equal(Math.floor(info.version / 10000), 17);

    // Ephemeral CI database: only the synthetic fixture ID is used.
    await real.query('CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, political_opinions_consent boolean NOT NULL)');
    await real.query('CREATE TABLE IF NOT EXISTS user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await real.query('CREATE TABLE IF NOT EXISTS voti_capo_stato (id uuid PRIMARY KEY, userid uuid NOT NULL, nome text, timestamp timestamptz DEFAULT NOW())');
    const reset = async () => {
      await real.query('INSERT INTO users (id,political_opinions_consent) VALUES ($1,true) ON CONFLICT (id) DO UPDATE SET political_opinions_consent=true', [ID]);
      await real.query('INSERT INTO user_consents (user_id,political_opinions_consent) VALUES ($1,true) ON CONFLICT (user_id) DO UPDATE SET political_opinions_consent=true', [ID]);
      await real.query('DELETE FROM voti_capo_stato WHERE userid=$1', [ID]);
    };
    const inspect = async () => {
      const consent = (await real.query(
        'SELECT u.political_opinions_consent AS base, uc.political_opinions_consent AS override FROM users u JOIN user_consents uc ON uc.user_id=u.id WHERE u.id=$1', [ID]
      )).rows[0];
      const votes = (await real.query(
        'SELECT nome FROM voti_capo_stato WHERE userid=$1', [ID]
      )).rows.map(x => x.nome);
      return { base: consent.base, override: consent.override, votes };
    };
    const pass = (_req, _res, next) => next();
    require.cache[modulePaths[0]] = {
      id: modulePaths[0], filename: modulePaths[0], loaded: true,
      exports: {
        verifyToken(req, res, next) {
          if (req.get('authorization') !== 'Bearer synthetic-only') return res.status(401).json({ success: false });
          req.userId = ID;
          req.user = { id: ID, isAdmin: false };
          next();
        },
        requireAdmin: pass
      }
    };
    require.cache[modulePaths[1]] = { id: modulePaths[1], filename: modulePaths[1], loaded: true, exports: { requireVerifiedCivicIdentity: pass } };
    // Purposefully bypass the preliminary check. The POST must enforce its
    // own locked consent check even when middleware saw old consent.
    require.cache[modulePaths[2]] = { id: modulePaths[2], filename: modulePaths[2], loaded: true, exports: { requirePoliticalConsent: pass } };
    require.cache[modulePaths[3]] = { id: modulePaths[3], filename: modulePaths[3], loaded: true, exports: { getPool: () => pool } };
    require.cache[modulePaths[4]] = {
      id: modulePaths[4], filename: modulePaths[4], loaded: true,
      exports: {
        getPreferenceCooldown: async () => ({ isBlocked: false, unlockDate: null }),
        assertPreferenceChangeAllowed: async () => {},
        recordPreferenceChange: async () => {},
        sendCooldownError: () => false
      }
    };
    delete require.cache[modulePaths[5]];
    const router = require('../routes/capo-stato');
    const app = express();
    app.use(express.json());
    app.use('/api/capo-stato', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const save = () => fetch(base + '/api/capo-stato/vota', {
      method: 'POST', headers: {
        authorization: 'Bearer synthetic-only', 'content-type': 'application/json'
      }, body: JSON.stringify({ voti: ['Synthetic Candidate'] }),
      signal: AbortSignal.timeout(12000)
    });

    async function revoke(pauseAfterLock) {
      const c = await real.connect();
      let tx = false;
      try {
        await c.query('BEGIN'); tx = true;
        if (!pauseAfterLock) hold.contender.resolve();
        await c.query('UPDATE users SET political_opinions_consent=false WHERE id=$1', [ID]);
        if (pauseAfterLock) {
          hold.locked.resolve();
          await timeout(hold.resume.promise);
        }
        await c.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [ID]);
        await c.query('DELETE FROM voti_capo_stato WHERE userid=$1', [ID]);
        await c.query('COMMIT'); tx = false;
      } finally {
        if (tx) await c.query('ROLLBACK');
        c.release();
      }
    }

    // SAVE first: revocation waits for the user lock, then deletes the vote.
    await reset();
    hold = { phase: 'save', locked: gate(), resume: gate(), contender: gate(), paused: false };
    const savedFirst = save();
    await timeout(hold.locked.promise);
    const revokedSecond = revoke(false);
    await timeout(hold.contender.promise);
    hold.resume.resolve();
    const response = await timeout(savedFirst);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    await timeout(revokedSecond);
    assert.deepEqual(await inspect(), { base: false, override: false, votes: [] });

    // REVOKE first: POST waits for the lock, rechecks consent and returns 403.
    await reset();
    hold = { phase: 'revoke', locked: gate(), resume: gate(), contender: gate() };
    const revokedFirst = revoke(true);
    await timeout(hold.locked.promise);
    const savedSecond = save();
    await timeout(hold.contender.promise);
    hold.resume.resolve();
    await timeout(revokedFirst);
    const denied = await timeout(savedSecond);
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).consent_required, true);
    assert.match(denied.headers.get('cache-control') || '', /no-store/);
    assert.deepEqual(await inspect(), { base: false, override: false, votes: [] });

    // Fresh explicit consent still permits an ordinary save.
    await reset(); hold = null;
    assert.equal((await save()).status, 200);
    assert.deepEqual(await inspect(), {
      base: true, override: true, votes: ['Synthetic Candidate']
    });
    console.log('HEAD_OF_STATE_VOTE_SAVE_REVOKE_PG17_SYNTHETIC_PASS');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [p, original] of originals) {
      if (original) require.cache[p] = original;
      else delete require.cache[p];
    }
    await real.end();
  }
}
main().catch(error => {
  console.error('HEAD_OF_STATE_VOTE_SYNTHETIC_TEST_FAIL', error);
  process.exitCode = 1;
});
