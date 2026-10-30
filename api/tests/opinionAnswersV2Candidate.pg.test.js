'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQL } = require('../experiments/opinionAnswersV2Candidate');

// Entirely synthetic GitHub Actions PostgreSQL 17. Never point this test at
// Supabase, Render, a shared staging database or any non-loopback address.
const connectionString = process.env.OPINION_V2_PG_CI_URL;
const enabled = Boolean(connectionString && process.env.GITHUB_ACTIONS === 'true');

test('real PostgreSQL 17: atomic JSONB deltas preserve unrelated answers', {skip:!enabled}, async () => {
  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
      url.pathname !== '/opinion_answers_ci') {
    throw new Error('Refusing to use a nonlocal or non-ephemeral research database');
  }
  const {Client} = require('pg');
  const first = new Client({connectionString, connectionTimeoutMillis:5000});
  const second = new Client({connectionString, connectionTimeoutMillis:5000});
  const uid = '00000000-0000-4000-8000-000000000099';
  const testTable = 'opinion_answer_maps_v2_ci';
  const upsert = SQL.upsertPatch.replaceAll(
    'demos_private.opinion_answer_maps_v2', testTable
  );

  await first.connect();
  try {
    await second.connect();
    await first.query('DROP TABLE IF EXISTS opinion_answer_maps_v2_ci');
    await first.query(`CREATE TABLE opinion_answer_maps_v2_ci (
      user_id uuid PRIMARY KEY,
      answers jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(answers) = 'object'),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);

    // Answer to old question. Later add a 95th ID: only a JSONB key, no DDL.
    await first.query(upsert, [uid, JSON.stringify({opinione_0:'f'})]);
    await Promise.all([
      first.query(upsert, [uid, JSON.stringify({opinione_94:'c'})]),
      second.query(upsert, [uid, JSON.stringify({opinione_1:'i'})])
    ]);
    let result = await first.query(
      'SELECT answers FROM opinion_answer_maps_v2_ci WHERE user_id=$1', [uid]
    );
    assert.deepEqual(result.rows[0].answers, {
      opinione_0:'f', opinione_94:'c', opinione_1:'i'
    });

    // Removing a question from published catalog never erases its history.
    await second.query(upsert, [uid, JSON.stringify({opinione_0:'c'})]);
    result = await first.query(
      'SELECT answers FROM opinion_answer_maps_v2_ci WHERE user_id=$1', [uid]
    );
    assert.equal(result.rows[0].answers.opinione_94, 'c');
    assert.equal(result.rows[0].answers.opinione_0, 'c');
    const count = await first.query('SELECT count(*)::integer AS n FROM opinion_answer_maps_v2_ci');
    assert.equal(count.rows[0].n, 1);

    // Wrong JSON shape rejected by the storage constraint.
    await assert.rejects(
      first.query(upsert, [uid, JSON.stringify(['f'])]),
      /violates check constraint/
    );
  } finally {
    await first.query('DROP TABLE IF EXISTS opinion_answer_maps_v2_ci');
    await second.end();
    await first.end();
  }
});
