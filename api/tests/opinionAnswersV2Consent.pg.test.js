'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQL } = require('../experiments/opinionAnswersV2Candidate');

// This exercises the intended transaction protocol with invented identities.
// It is NOT an integration with production routes, erasure or restore.
const connectionString = process.env.OPINION_V2_PG_CI_URL;
const enabled = Boolean(connectionString && process.env.GITHUB_ACTIONS === 'true');
const userId = '00000000-0000-4000-8000-000000000088';

test('PostgreSQL 17: consent and user lock serialize writes with erasure', { skip: !enabled }, async () => {
  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
      url.pathname !== '/opinion_answers_ci') {
    throw new Error('Only synthetic loopback opinion_answers_ci database is permitted');
  }
  const { Client } = require('pg');
  const a = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  const b = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  const upsert = SQL.upsertPatch.replaceAll(
    'demos_private.opinion_answer_maps_v2', 'opinion_v2_consent_answers_ci'
  );
  async function consentCheckedSave(client, answer) {
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      const locked = await client.query(
        'SELECT id FROM opinion_v2_consent_users_ci WHERE id=$1 FOR UPDATE', [userId]
      );
      if (locked.rowCount === 0) { await client.query('ROLLBACK'); return false; }
      // Intentionally a separate SELECT, AFTER acquiring FOR UPDATE:
      // READ COMMITTED must see a revocation that committed while waiting.
      const current = await client.query(
        'SELECT consent FROM opinion_v2_consent_users_ci WHERE id=$1', [userId]
      );
      if (!current.rows[0].consent) { await client.query('ROLLBACK'); return false; }
      await client.query(upsert, [userId, JSON.stringify({ opinione_0: answer })]);
      await client.query('COMMIT');
      return true;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
  }
  async function revokeAndErase(client) {
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query(
        'SELECT id FROM opinion_v2_consent_users_ci WHERE id=$1 FOR UPDATE', [userId]
      );
      await client.query(
        'UPDATE opinion_v2_consent_users_ci SET consent=false WHERE id=$1', [userId]
      );
      await client.query(
        'DELETE FROM opinion_v2_consent_answers_ci WHERE user_id=$1', [userId]
      );
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
  }
  async function assertErased(client) {
    const rows = await client.query(
      'SELECT answers FROM opinion_v2_consent_answers_ci WHERE user_id=$1', [userId]
    );
    assert.equal(rows.rowCount, 0);
  }

  await a.connect();
  try {
    await b.connect();
    await a.query('DROP TABLE IF EXISTS opinion_v2_consent_answers_ci');
    await a.query('DROP TABLE IF EXISTS opinion_v2_consent_users_ci');
    await a.query('CREATE TABLE opinion_v2_consent_users_ci (id uuid PRIMARY KEY, consent boolean NOT NULL)');
    await a.query(
      "CREATE TABLE opinion_v2_consent_answers_ci (" +
      "user_id uuid PRIMARY KEY REFERENCES opinion_v2_consent_users_ci(id) ON DELETE CASCADE," +
      "answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object')," +
      "updated_at timestamptz NOT NULL DEFAULT now())"
    );
    await a.query('INSERT INTO opinion_v2_consent_users_ci VALUES ($1, true)', [userId]);

    // Save owns user lock. Revocation takes that same lock and then deletes
    // the saved answers in its own atomic transaction.
    assert.equal(await consentCheckedSave(a, 'f'), true);
    await a.query('BEGIN');
    await a.query('SELECT id FROM opinion_v2_consent_users_ci WHERE id=$1 FOR UPDATE', [userId]);
    const queuedRevocation = revokeAndErase(b);
    await a.query(upsert, [userId, '{"opinione_0":"i"}']);
    await a.query('COMMIT');
    await queuedRevocation;
    await assertErased(a);

    // When revocation wins first, the next save sees false consent and cannot
    // recreate the erased row.
    assert.equal(await consentCheckedSave(a, 'c'), false);
    await assertErased(a);

    // A revocation holding the user lock wins before a queued save.
    // The pending save MUST check consent in a separate statement after
    // it acquires the lock, so it cannot resurrect deleted answers.
    await a.query('UPDATE opinion_v2_consent_users_ci SET consent=true WHERE id=$1', [userId]);
    await b.query('BEGIN');
    await b.query('SELECT id FROM opinion_v2_consent_users_ci WHERE id=$1 FOR UPDATE', [userId]);
    await b.query('UPDATE opinion_v2_consent_users_ci SET consent=false WHERE id=$1', [userId]);
    const queuedSave = consentCheckedSave(a, 'i');
    await b.query('DELETE FROM opinion_v2_consent_answers_ci WHERE user_id=$1', [userId]);
    await b.query('COMMIT');
    assert.equal(await queuedSave, false);
    await assertErased(a);

    // Regrant requires a separate approved flow in the actual app;
    // only the invented fixture is reused here.
    await a.query('UPDATE opinion_v2_consent_users_ci SET consent=true WHERE id=$1', [userId]);
    assert.equal(await consentCheckedSave(a, 'f'), true);
    const row = await a.query(
      'SELECT answers FROM opinion_v2_consent_answers_ci WHERE user_id=$1', [userId]
    );
    assert.deepEqual(row.rows[0].answers, {opinione_0:'f'});
    await revokeAndErase(b);
    await assertErased(a);
  } finally {
    await a.query('DROP TABLE IF EXISTS opinion_v2_consent_answers_ci');
    await a.query('DROP TABLE IF EXISTS opinion_v2_consent_users_ci');
    await b.end();
    await a.end();
  }
});
