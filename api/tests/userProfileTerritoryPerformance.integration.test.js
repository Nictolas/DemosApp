'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

const pgTest = process.env.PROFILE_READ_PG_INTEGRATION === '1' ? test : test.skip;
const BASELINE = `SELECT u.id FROM users u
  LEFT JOIN user_profile p ON p.user_id=u.id
  WHERE COALESCE(p.comune_residenza,u.comune_residenza)=$1`;
// Compatibility-preserving partition: profile has value / profile NULL / missing profile.
// Branches are disjoint and preserve all existing COALESCE semantics.
const PARTITIONED = `
  SELECT u.id FROM user_profile p JOIN users u ON u.id=p.user_id
    WHERE p.comune_residenza=$1
  UNION ALL
  SELECT u.id FROM users u JOIN user_profile p ON p.user_id=u.id
    WHERE p.comune_residenza IS NULL AND u.comune_residenza=$1
  UNION ALL
  SELECT u.id FROM users u
    WHERE u.comune_residenza=$1
      AND NOT EXISTS (SELECT 1 FROM user_profile p WHERE p.user_id=u.id)`;

pgTest('100k synthetic accounts: municipality query alternatives remain equivalent and measured outside production', async () => {
  const db = new Client({
    host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
  });
  await db.connect();
  try {
    await db.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, comune_residenza text)');
    await db.query('CREATE TEMP TABLE user_profile (user_id uuid PRIMARY KEY REFERENCES users(id), comune_residenza text)');
    await db.query(`INSERT INTO users (id, comune_residenza)
      SELECT md5(n::text)::uuid,
        CASE WHEN n % 100 = 0 THEN 'Pisa' ELSE 'C' || (n % 100)::text END
      FROM generate_series(1,100000) n`);
    await db.query(`INSERT INTO user_profile (user_id, comune_residenza)
      SELECT md5(n::text)::uuid,
        CASE WHEN n % 31 = 0 THEN NULL
          WHEN n % 17 = 0 THEN 'Pisa'
          ELSE CASE WHEN n % 100 = 0 THEN 'Pisa' ELSE 'C' || (n % 100)::text END END
      FROM generate_series(1,100000) n
      WHERE n % 10 <> 0`);
    await db.query('CREATE INDEX users_municipality_qa_idx ON users(comune_residenza)');
    await db.query('CREATE INDEX profile_municipality_qa_idx ON user_profile(comune_residenza)');
    await db.query('ANALYZE users');
    await db.query('ANALYZE user_profile');
    const missing = await db.query(`SELECT COUNT(*)::integer AS missing
      FROM users u LEFT JOIN user_profile p ON p.user_id=u.id WHERE p.user_id IS NULL`);
    assert.equal(missing.rows[0].missing, 10000);
    const correctness = await db.query(`
      WITH baseline AS (${BASELINE}), candidate AS (${PARTITIONED}),
      only_baseline AS (SELECT id FROM baseline EXCEPT SELECT id FROM candidate),
      only_candidate AS (SELECT id FROM candidate EXCEPT SELECT id FROM baseline)
      SELECT (SELECT COUNT(*)::integer FROM baseline) AS baseline_total,
             (SELECT COUNT(*)::integer FROM candidate) AS candidate_total,
             (SELECT COUNT(*)::integer FROM only_baseline) AS missing_candidate,
             (SELECT COUNT(*)::integer FROM only_candidate) AS extra_candidate`, ['Pisa']);
    const row = correctness.rows[0];
    assert.equal(row.missing_candidate, 0);
    assert.equal(row.extra_candidate, 0);
    assert.equal(row.baseline_total, row.candidate_total);
    assert.ok(row.baseline_total > 0);
    const summaries = [];
    for (const [name, sql] of [['coalesce_join', BASELINE], ['partitioned_union', PARTITIONED]]) {
      const explained = await db.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, ['Pisa']);
      const plan = explained.rows[0]['QUERY PLAN'][0];
      summaries.push({
        strategy: name, syntheticUsers: 100000,
        planningMs: Number(plan['Planning Time'].toFixed(3)),
        executionMs: Number(plan['Execution Time'].toFixed(3)),
        rootNode: plan.Plan['Node Type'],
        resultRows: plan.Plan['Actual Rows'],
      });
    }
    // Diagnostic benchmark, no pass/fail on wall time (shared CI hardware varies).
    console.log('SYNTHETIC_MUNICIPALITY_QA ' + JSON.stringify({ equivalence: row, plans: summaries }));
  } finally {
    await db.end();
  }
});
