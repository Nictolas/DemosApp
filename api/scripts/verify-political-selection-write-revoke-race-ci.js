'use strict';

// Real PostgreSQL 17 cross-transaction race proof on synthetic localhost only.
// Never connects to Supabase/Render, never uses personal or production data.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { setPoliticalSelection } = require('../services/politicalSelectionService');

const USER = '00000000-0000-4000-8000-000000000289';
const TARGET = '00000000-0000-4000-8000-000000000290';
const DB = 'political_consent_race_ci';
const timeout = (p, milliseconds = 8500) => Promise.race([
  p, new Promise((_, reject) => setTimeout(() => reject(Error('Synthetic race timeout')), milliseconds))
]);
function gate() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function guard() {
  const expected = {
    GITHUB_ACTIONS: 'true',
    POLITICAL_CONSENT_RACE_CI: 'synthetic',
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: DB,
    PGUSER: 'postgres',
    PGPASSWORD: 'synthetic-only'
  };
  for (const [name, value] of Object.entries(expected)) {
    if (process.env[name] !== value) throw Error('Refusing non-synthetic DB: ' + name);
  }
  for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RENDER']) {
    if (process.env[key]) throw Error('Production environment forbidden: ' + key);
  }
}

async function main() {
  guard();
  const real = new Pool({
    host: '127.0.0.1', port: 5432, database: DB, user: 'postgres',
    password: 'synthetic-only', max: 5, connectionTimeoutMillis: 3500,
    statement_timeout: 8000, application_name: 'synthetic_selection_consent_race'
  });
  let hold = null;
  try {
    const meta = (await real.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(meta.db, DB);
    assert.equal(Math.floor(meta.version / 10000), 17);
    // The guard above confines these DDL statements to ephemeral GitHub CI.
    await real.query('CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, political_opinions_consent boolean NOT NULL)');
    await real.query('CREATE TABLE IF NOT EXISTS user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await real.query(
      'CREATE TABLE IF NOT EXISTS political_selections (' +
      'user_id uuid NOT NULL, selection_kind text NOT NULL, jurisdiction_id text NOT NULL,' +
      'political_office_id text NOT NULL, selected_user_id uuid NOT NULL,' +
      'selected_candidacy_id uuid, selected_mandate_id uuid, source text, context jsonb,' +
      'updated_at timestamptz DEFAULT NOW(),' +
      'UNIQUE (user_id, selection_kind, political_office_id))'
    );

    async function reset() {
      await real.query('DELETE FROM political_selections WHERE user_id=$1', [USER]);
      await real.query(
        'INSERT INTO users(id,political_opinions_consent) VALUES($1,true) ' +
        'ON CONFLICT(id) DO UPDATE SET political_opinions_consent=true', [USER]
      );
      await real.query(
        'INSERT INTO user_consents(user_id,political_opinions_consent) VALUES($1,true) ' +
        'ON CONFLICT(user_id) DO UPDATE SET political_opinions_consent=true', [USER]
      );
    }
    async function inspect() {
      const state = (await real.query(
        'SELECT COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) AS granted ' +
        'FROM users u LEFT JOIN user_consents uc ON uc.user_id=u.id WHERE u.id=$1', [USER]
      )).rows[0];
      const choices = (await real.query(
        'SELECT selected_user_id::text AS id FROM political_selections WHERE user_id=$1', [USER]
      )).rows.map(x => x.id);
      return { granted: state.granted, choices };
    }
    async function save(selectedUserId = TARGET) {
      const c = await real.connect();
      let open = false;
      try {
        await c.query('BEGIN');
        open = true;
        const tx = {
          async query(sql, params) {
            const statement = String(sql).replace(/\s+/g, ' ').trim();
            if (hold?.phase === 'revoke' && statement === 'SELECT id FROM users WHERE id = $1 FOR UPDATE')
              hold.contender.resolve();
            const answer = await c.query(sql, params);
            if (hold?.phase === 'save' && !hold.paused && statement === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
              hold.paused = true;
              hold.locked.resolve();
              await timeout(hold.resume.promise);
            }
            return answer;
          }
        };
        try {
          const result = await setPoliticalSelection(tx, {
            userId: USER, kind: 'candidate', officeValue: 'us.house', adapterId: 'us',
            selectedUserId, source: 'matching'
          });
          await c.query('COMMIT');
          open = false;
          return { ok: true, result };
        } catch (error) {
          return { ok: false, code: error.code };
        }
      } finally {
        if (open) await c.query('ROLLBACK');
        c.release();
      }
    }
    async function revoke(pauseAfterLock) {
      const c = await real.connect();
      let open = false;
      try {
        await c.query('BEGIN'); open = true;
        await c.query('UPDATE users SET political_opinions_consent=false WHERE id=$1', [USER]);
        if (pauseAfterLock) {
          hold.locked.resolve();
          await timeout(hold.resume.promise);
        }
        await c.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [USER]);
        // Selection erasure is NOT part of the current documented cleanup.
        // Do not invent an erasure policy in this concurrency test.
        await c.query('COMMIT'); open = false;
      } finally {
        if (open) await c.query('ROLLBACK');
        c.release();
      }
    }

    await reset();
    hold = { phase: 'save', locked: gate(), resume: gate(), contender: gate(), paused: false };
    const savedFirst = save();
    await timeout(hold.locked.promise);
    const revokeSecond = revoke(false);
    hold.resume.resolve();
    const before = await timeout(savedFirst);
    assert.equal(before.ok, true, 'Save owns lock before revoke');
    await timeout(revokeSecond);
    assert.deepEqual(await inspect(), { granted: false, choices: [TARGET] },
      'The pending erasure policy is separate; consent must be revoked after save');

    await reset();
    hold = { phase: 'revoke', locked: gate(), resume: gate(), contender: gate() };
    const revokeFirst = revoke(true);
    await timeout(hold.locked.promise);
    const saveSecond = save();
    await timeout(hold.contender.promise);
    hold.resume.resolve();
    await timeout(revokeFirst);
    const after = await timeout(saveSecond);
    assert.equal(after.ok, false);
    assert.equal(after.code, 'POLITICAL_SELECTION_CONSENT_REQUIRED');
    assert.deepEqual(await inspect(), { granted: false, choices: [] },
      'A save started before revoke COMMIT must not resurrect a choice');

    hold = null;
    const revokedDirect = await save();
    assert.equal(revokedDirect.code, 'POLITICAL_SELECTION_CONSENT_REQUIRED');
    assert.deepEqual(await inspect(), { granted: false, choices: [] });

    const removed = await save(null);
    assert.equal(removed.ok, true, 'Voluntary removal remains allowed after revocation');
    assert.deepEqual(await inspect(), { granted: false, choices: [] });

    await reset();
    const ordinary = await save();
    assert.equal(ordinary.ok, true);
    assert.deepEqual(await inspect(), { granted: true, choices: [TARGET] });
    console.log('POLITICAL_SELECTION_SAVE_REVOKE_PG17_SYNTHETIC_PASS');
  } finally {
    await real.end();
  }
}

main().catch(error => {
  console.error('POLITICAL_SELECTION_SAVE_REVOKE_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
