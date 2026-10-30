'use strict';

// Synthetic PostgreSQL 17 storage/query benchmark. This script MUST NOT run
// against Supabase, Render or any real/staging database.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const urlString = process.env.OPINION_V2_PG_CI_URL;
if (!urlString || process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('This benchmark only runs in isolated GitHub Actions PostgreSQL CI');
}
const url = new URL(urlString);
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
    url.pathname !== '/opinion_answers_ci') {
  throw new Error('Benchmark refuses nonlocal/non-ephemeral PostgreSQL');
}

const N = 1200;
const Q = 94;
const key = (i) => 'opinione_' + i;
const columns = Array.from({length:Q}, (_, i) => '"' + key(i) + '"');
const tables = ['opinion_v2_bench_wide', 'opinion_v2_bench_json',
                'opinion_v2_bench_eav'];
const answer = (g, i) => {
  const m = (g * 37 + i * 17) % 3;
  return m === 0 ? 'f' : m === 1 ? 'c' : 'i';
};
const expr = (index, density) =>
  "CASE WHEN ((g * 13 + " + index + " * 19) % 100) < " + density +
  " THEN CASE ((g * 37 + " + index + " * 17) % 3)" +
  " WHEN 0 THEN 'f' WHEN 1 THEN 'c' ELSE 'i' END ELSE NULL END";

const percentile = (items, p) => {
  const xs = [...items].sort((a,b)=>a-b);
  return Math.round(xs[Math.ceil(p * xs.length) - 1] * 1000) / 1000;
};
async function queryTimeMs(client, sql) {
  const r = await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + sql);
  return r.rows[0]['QUERY PLAN'][0]['Execution Time'];
}
async function size(client, table) {
  const r = await client.query(
    'SELECT pg_total_relation_size($1::regclass) AS bytes', [table]
  );
  return Number(r.rows[0].bytes);
}
async function drop(client) {
  for (const table of tables) await client.query('DROP TABLE IF EXISTS ' + table);
}
async function run() {
  const client = new Client({connectionString:urlString, connectionTimeoutMillis:5000});
  await client.connect();
  try {
    const outputs = [];
    for (const density of [9, 45]) {
      await drop(client);
      await client.query('CREATE TABLE opinion_v2_bench_wide (' +
        'user_id integer PRIMARY KEY, ' + columns.map(c => c + ' text').join(',') + ')');
      await client.query('CREATE TABLE opinion_v2_bench_json (' +
        "user_id integer PRIMARY KEY, answers jsonb NOT NULL DEFAULT '{}'::jsonb)");
      await client.query('CREATE TABLE opinion_v2_bench_eav (' +
        "user_id integer NOT NULL, opinion_id text NOT NULL, answer text NOT NULL," +
        'PRIMARY KEY (user_id, opinion_id))');

      const wideSQL = 'INSERT INTO opinion_v2_bench_wide (user_id,' +
        columns.join(',') + ') SELECT g,' +
        columns.map((_, i) => expr(i, density)).join(',') +
        ' FROM generate_series(1,' + N + ') AS g';
      await client.query(wideSQL);

      // Identical synthetic data for JSONB and normalized formats.
      const base = "FROM generate_series(1," + N + ") AS g " +
        'CROSS JOIN generate_series(0,' + (Q-1) + ') AS i ' +
        'WHERE ((g*13 + i*19) % 100) < ' + density;
      const rows = 'SELECT g AS user_id, ' +
        "'opinione_' || i AS opinion_id, CASE ((g*37 + i*17) % 3) " +
        "WHEN 0 THEN 'f' WHEN 1 THEN 'c' ELSE 'i' END AS answer " + base;
      await client.query('INSERT INTO opinion_v2_bench_eav (user_id,opinion_id,answer) ' +
        'SELECT user_id,opinion_id,answer FROM (' + rows + ') q');
      await client.query('INSERT INTO opinion_v2_bench_json (user_id,answers) ' +
        "SELECT g, COALESCE(jsonb_object_agg(opinion_id,answer) " +
        "FILTER (WHERE opinion_id IS NOT NULL), '{}'::jsonb) " +
        'FROM generate_series(1,' + N + ') AS g ' +
        'LEFT JOIN opinion_v2_bench_eav e ON e.user_id = g GROUP BY g');

      // Needed for per-user reads and per-opinion aggregates; index sizes
      // are part of total_relation_size below.
      await client.query('CREATE INDEX opinion_v2_bench_eav_op_idx ' +
        'ON opinion_v2_bench_eav (opinion_id, answer, user_id)');
      for (const table of tables) await client.query('ANALYZE ' + table);
      const metric = {users:N, opinions:Q, expectedDensityPercent:density,
        bytes:{}, aggregateMs:{}, personalReadMs:{}};
      for (const table of tables) {
        const k = table.split('_').at(-1);
        metric.bytes[k] = await size(client, table);
      }
      const k = key(7);
      const wideAggregate = 'SELECT count(*) FILTER (WHERE "' + k +
        "\"='f') AS f, count(*) FILTER (WHERE \"" + k +
        "\"='c') AS c, count(*) FILTER (WHERE \"" + k +
        "\"='i') AS i FROM opinion_v2_bench_wide";
      const jsonAggregate = "SELECT count(*) FILTER (WHERE answers->>'" + k +
        "'='f') AS f, count(*) FILTER (WHERE answers->>'" + k +
        "'='c') AS c, count(*) FILTER (WHERE answers->>'" + k +
        "'='i') AS i FROM opinion_v2_bench_json";
      const eavAggregate = "SELECT count(*) FILTER (WHERE answer='f') AS f," +
        " count(*) FILTER (WHERE answer='c') AS c," +
        " count(*) FILTER (WHERE answer='i') AS i" +
        " FROM opinion_v2_bench_eav WHERE opinion_id='" + k + "'";
      const wideRead = 'SELECT ' + columns.join(',') +
        ' FROM opinion_v2_bench_wide WHERE user_id=500';
      const jsonRead = 'SELECT answers FROM opinion_v2_bench_json WHERE user_id=500';
      const eavRead = 'SELECT opinion_id, answer FROM opinion_v2_bench_eav WHERE user_id=500';
      const a = [wideAggregate, jsonAggregate, eavAggregate];
      const p = [wideRead, jsonRead, eavRead];
      const kinds = ['wide','json','eav'];
      const counts = await Promise.all(a.map(async sql => {
        const r=await client.query(sql);
        return r.rows[0];
      }));
      assert.deepEqual(counts[0], counts[1]);
      assert.deepEqual(counts[1], counts[2]);

      for (let j=0;j<3;j++) {
        const agg=[], user=[];
        for (let n=0;n<12;n++) {
          agg.push(await queryTimeMs(client,a[j]));
          user.push(await queryTimeMs(client,p[j]));
        }
        metric.aggregateMs[kinds[j]]={p50:percentile(agg,.5),p95:percentile(agg,.95)};
        metric.personalReadMs[kinds[j]]={p50:percentile(user,.5),p95:percentile(user,.95)};
      }
      metric.sampleOpinionCounts = counts[0];
      outputs.push(metric);
    }
    console.log('OPINION_V2_SYNTHETIC_BENCHMARK_JSON=' + JSON.stringify(outputs));
  } finally {
    await drop(client);
    await client.end();
  }
}
run().catch(e => {
  console.error('Synthetic benchmark failed:', e.code || e.name || 'UNKNOWN');
  process.exitCode=1;
});
