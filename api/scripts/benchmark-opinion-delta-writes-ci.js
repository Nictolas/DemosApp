'use strict';
/**
 * Synthetic-only PostgreSQL 17 paired baseline vs delta-write benchmark.
 * Reproduces DB statements used by POST /api/opinioni/salva after the consent lock.
 * Not an HTTP benchmark, production estimate, or live Supabase test.
 */
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { Pool } = require('pg');

const DATABASE = 'opinion_delta_ci';
const SCHEMA = 'delta_bench';
const IDS = Array.from({ length: 94 }, (_, index) => 'q' + String(index + 1).padStart(3, '0'));
const WARMUP = 8;
const SAMPLES = 35;

function guard() {
  const e = process.env;
  const valid = e.GITHUB_ACTIONS === 'true' &&
    e.OPINION_DELTA_CI === 'isolated' &&
    e.PGHOST === '127.0.0.1' && e.PGPORT === '5432' &&
    e.PGDATABASE === DATABASE && e.PGUSER === 'postgres' &&
    e.PGPASSWORD === 'synthetic-only' &&
    !e.DATABASE_URL && !e.SUPABASE_DB_URL;
  if (!valid) throw Error('Refusing opinion benchmark outside synthetic PostgreSQL CI');
}
function percentile(values, ratio) {
  const a = [...values].sort((x, y) => x - y);
  return Number(a[Math.max(0, Math.ceil(a.length * ratio) - 1)].toFixed(3));
}
function summary(values) {
  return { samples: values.length, p50Ms: percentile(values, .5),
    p95Ms: percentile(values, .95) };
}
function createUserId(n) {
  return '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
}
function answerSet(dense) {
  return Object.fromEntries(IDS.filter((_, i) => dense || i % 12 === 0)
    .map((id, index) => [id, index % 2 ? 'c' : 'f']));
}
async function setup(db) {
  const v = await db.query('SHOW server_version_num');
  assert.equal(Math.floor(Number(v.rows[0].server_version_num) / 10000), 17);
  await db.query('CREATE SCHEMA ' + SCHEMA);
  await db.query('SET search_path TO ' + SCHEMA);
  await db.query('CREATE TABLE users (id uuid PRIMARY KEY, political_opinions_consent boolean NOT NULL)');
  await db.query('CREATE TABLE user_consents (user_id uuid PRIMARY KEY REFERENCES users(id), political_opinions_consent boolean)');
  await db.query('CREATE TABLE opinioni_risposte (user_id uuid PRIMARY KEY REFERENCES users(id), ' +
    IDS.map(id => '"' + id + '" TEXT').join(',') + ')');

  for (const [i, dense] of [false, true].entries()) {
    const userId = createUserId(i + 1);
    const answers = answerSet(dense);
    await db.query('INSERT INTO users (id, political_opinions_consent) VALUES ($1, true)', [userId]);
    await db.query('INSERT INTO user_consents (user_id, political_opinions_consent) VALUES ($1, true)', [userId]);
    const keys = Object.keys(answers);
    const placeholders = keys.map((_, n) => '$' + (n + 2));
    await db.query('INSERT INTO opinioni_risposte (user_id,' +
      keys.map(k => '"' + k + '"').join(',') + ') VALUES ($1,' +
      placeholders.join(',') + ')', [userId, ...keys.map(k => answers[k])]);
  }
}
function makeUpdate(fields, values, userId) {
  assert.ok(fields.every(f => IDS.includes(f)), 'Unlisted SQL column');
  const set = fields.map((f, i) => '"' + f + '" = $' + (i + 1)).join(', ');
  const query = 'UPDATE opinioni_risposte SET ' + set +
    ' WHERE user_id = $' + (fields.length + 1);
  return { query, params: [...values, userId] };
}
async function run(db, mode, scenario, capturePlan) {
  let walBytes = 0;
  let updateCount = 0;
  let statements = 0;
  const timedQuery = async (...args) => {
    statements++;
    return db.query(...args);
  };
  const begin = performance.now();
  await timedQuery('BEGIN');
  try {
    const userId = createUserId(scenario.dense ? 2 : 1);
    const locked = await timedQuery('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    assert.equal(locked.rows.length, 1);
    const consent = await timedQuery(
      'SELECT COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) AS granted ' +
      'FROM users u LEFT JOIN user_consents uc ON uc.user_id=u.id WHERE u.id=$1', [userId]);
    assert.equal(consent.rows[0].granted, true);
    const values = scenario.submitted;
    const fields = Object.keys(values);
    const existing = await timedQuery('SELECT user_id,' + fields.map(x => '"' + x + '"').join(',') +
      ' FROM opinioni_risposte WHERE user_id=$1 FOR UPDATE', [userId]);
    assert.equal(existing.rows.length, 1);
    const changes = fields.filter(field => existing.rows[0][field] !== values[field]);
    const writeFields = mode === 'legacy' ? fields : changes;
    if (writeFields.length > 0) {
      const update = makeUpdate(writeFields, writeFields.map(field => values[field]), userId);
      const statement = capturePlan ?
        'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) ' + update.query : update.query;
      const result = await timedQuery(statement, update.params);
      updateCount++;
      if (capturePlan) {
        const explain = result.rows[0]['QUERY PLAN'];
        const plan = (typeof explain === 'string' ? JSON.parse(explain) : explain)[0].Plan;
        walBytes = Number(plan['WAL Bytes'] || 0);
        assert.equal(plan['Actual Rows'], 1);
      } else {
        assert.equal(result.rowCount, 1);
      }
    }
    // Rollback restores the same input row for the next paired run.
    await timedQuery('ROLLBACK');
    return { ms: performance.now() - begin, statements, updateCount, walBytes };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
async function verify(db, scenario, mode) {
  const userId = createUserId(scenario.dense ? 2 : 1);
  const key = scenario.changedKey;
  const before = (await db.query('SELECT "' + key + '" FROM opinioni_risposte WHERE user_id=$1', [userId])).rows[0][key];
  const outcome = await run(db, mode, scenario, false);
  const after = (await db.query('SELECT "' + key + '" FROM opinioni_risposte WHERE user_id=$1', [userId])).rows[0][key];
  assert.equal(before, after, 'Benchmark must never persist test mutations');
  assert.equal(outcome.updateCount, mode === 'legacy' || scenario.change ? 1 : 0);
  assert.equal(outcome.statements, mode === 'legacy' || scenario.change ? 6 : 5);
}
async function main() {
  guard();
  const pool = new Pool({ host: '127.0.0.1', port: 5432, database: DATABASE,
    user: 'postgres', password: 'synthetic-only', max: 1 });
  const db = await pool.connect();
  try {
    await setup(db);
    const cases = [];
    for (const dense of [false, true]) {
      const original = answerSet(dense);
      const changedKey = Object.keys(original)[Math.floor(Object.keys(original).length / 2)];
      for (const change of [false, true]) {
        const submitted = { ...original };
        if (change) submitted[changedKey] = original[changedKey] === 'f' ? 'c' : 'f';
        cases.push({ name: (dense ? 'dense' : 'sparse') + '_' + (change ? 'one_change' : 'no_change'),
          dense, change, submitted, changedKey });
      }
    }
    const output = [];
    for (const scenario of cases) {
      for (const mode of ['legacy', 'delta']) await verify(db, scenario, mode);
      const runs = { legacy: [], delta: [] };
      const wal = { legacy: [], delta: [] };
      const count = { legacy: [], delta: [] };
      for (let i = 0; i < SAMPLES + WARMUP; i++) {
        const modes = i % 2 === 0 ? ['legacy', 'delta'] : ['delta', 'legacy'];
        for (const mode of modes) {
          const result = await run(db, mode, scenario, true);
          if (i < WARMUP) continue;
          runs[mode].push(result.ms);
          wal[mode].push(result.walBytes);
          count[mode].push(result.updateCount);
        }
      }
      const item = { scenario: scenario.name, answersSubmitted: Object.keys(scenario.submitted).length };
      for (const mode of ['legacy', 'delta']) {
        item[mode] = { ...summary(runs[mode]),
          meanUpdateWalBytes: Math.round(wal[mode].reduce((a, b) => a + b, 0) / wal[mode].length),
          updateStatements: count[mode].reduce((a, b) => a + b, 0) };
      }
      output.push(item);
    }
    console.log('OPINION_DELTA_BENCHMARK_JSON ' + JSON.stringify({
      environment: 'isolated PostgreSQL 17 GitHub Actions with invented records',
      method: 'paired SQL transactions rolled back; EXPLAIN WAL Bytes covers UPDATE only',
      sampleSizePerVariant: SAMPLES, warmup: WARMUP, results: output
    }));
    // Guardrails, not claims of fixed speedups.
    for (const row of output) {
      assert.equal(row.legacy.updateStatements, SAMPLES);
      assert.equal(row.delta.updateStatements, row.scenario.endsWith('no_change') ? 0 : SAMPLES);
    }
  } finally {
    await db.query('DROP SCHEMA IF EXISTS ' + SCHEMA + ' CASCADE').catch(() => {});
    db.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
