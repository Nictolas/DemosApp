'use strict';

// Synthetic PostgreSQL 17 storage/query benchmark. This script MUST NOT run
// against Supabase, Render or any real/staging database.
const assert = require('node:assert/strict');
const { Client } = require('pg');
// Pinned, read-only source from PR #247, checked out separately by the
// research workflow. No codec implementation is copied into PR #483.
const { encodeAnswers } = require('../../_ci_op247/api/utils/opinionBitset');
const { encodeTrimmed } = require('../../_ci_op247/api/utils/opinionTrimmedBitset');
const { encodeSparse } = require('../../_ci_op247/api/utils/opinionSparseBitset');
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
                'opinion_v2_bench_eav', 'opinion_v2_bench_fixed',
                'opinion_v2_bench_trimmed', 'opinion_v2_bench_sparse'];
const catalogIds = Array.from({length:Q}, (_,i)=>key(i));
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
function packedAggregate(table, ordinal) {
  const byte = ordinal >> 2;
  const shift = 6 - 2 * (ordinal & 3);
  const code = table.endsWith('_sparse')
    ? 'opinion_v2_bench_sparse_slot(answers,' + ordinal + ')'
    : '(CASE WHEN octet_length(answers)>' + byte +
      ' THEN (get_byte(answers,' + byte + ') >> ' + shift +
      ') & 3 ELSE 0 END)';
  return 'SELECT count(*) FILTER (WHERE ' + code +
    '=1) AS f, count(*) FILTER (WHERE ' + code +
    '=2) AS c, count(*) FILTER (WHERE ' + code +
    '=3) AS i FROM ' + table;
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
    await client.query(
      'CREATE OR REPLACE FUNCTION opinion_v2_bench_sparse_slot(' +
      'packed bytea, target_index integer) RETURNS integer ' +
      'LANGUAGE plpgsql IMMUTABLE STRICT AS ' + String.fromCharCode(36).repeat(2) + ' ' +
      'DECLARE pos integer := -1; i integer; b integer; code integer; ' +
      'BEGIN IF target_index < 0 THEN RETURN 0; END IF; ' +
      'FOR i IN 0..octet_length(packed)-1 LOOP ' +
      'b := get_byte(packed,i); pos := pos + (b >> 2); code := b & 3; ' +
      'IF pos = target_index THEN RETURN code; END IF; ' +
      'IF pos > target_index THEN RETURN 0; END IF; ' +
      'END LOOP; RETURN 0; END ' + String.fromCharCode(36).repeat(2)
    );
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
      for (const format of ['fixed','trimmed','sparse']) {
        await client.query('CREATE TABLE opinion_v2_bench_' + format +
          ' (user_id integer PRIMARY KEY, catalog_version integer NOT NULL,' +
          ' answers bytea NOT NULL)');
      }

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

      // Materialize the EXACT EAV fixture as fixed/trimmed/sparse BYTEA.
      // Reuse the pinned published PR #247 codec, not a copied implementation.
      // Include a catalog version per row (no hidden dependency on SQL order).
      const publishedAnswers = new Map();
      const inputRows = await client.query(
        'SELECT user_id, opinion_id, answer FROM opinion_v2_bench_eav ' +
        'ORDER BY user_id, opinion_id'
      );
      for (const item of inputRows.rows) {
        const userId = Number(item.user_id);
        if (!publishedAnswers.has(userId)) publishedAnswers.set(userId, {});
        publishedAnswers.get(userId)[item.opinion_id] = item.answer;
      }
      const encode = {fixed:encodeAnswers, trimmed:encodeTrimmed, sparse:encodeSparse};
      for (const format of Object.keys(encode)) {
        for (let from=1;from<=N;from+=150) {
          const args=[], values=[];
          for(let g=from;g<=Math.min(from+149,N);g++){
            const offset=args.length;
            args.push(g, 1, encode[format](catalogIds,publishedAnswers.get(g)||{}));
            values.push('(' + [1,2,3].map(i=>String.fromCharCode(36)+(offset+i)).join(',') + ')');
          }
          await client.query('INSERT INTO opinion_v2_bench_'+format+
            ' (user_id,catalog_version,answers) VALUES '+values.join(','), args);
        }
      }

      // Needed for per-user reads and per-opinion aggregates; index sizes

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
      const a = [wideAggregate, jsonAggregate, eavAggregate,
        ...['fixed','trimmed','sparse'].map(x=>packedAggregate('opinion_v2_bench_'+x,7))];
      const p = [wideRead, jsonRead, eavRead,
        ...['fixed','trimmed','sparse'].map(x=>
          'SELECT catalog_version, answers FROM opinion_v2_bench_'+x+' WHERE user_id=500')];
      const kinds = ['wide','json','eav','fixed','trimmed','sparse'];
      const counts = await Promise.all(a.map(async sql => {
        const r=await client.query(sql);
        return r.rows[0];
      }));
      assert.deepEqual(counts[0], counts[1]);
      for (const count of counts) assert.deepEqual(count, counts[0]);
      for (let j=0;j<kinds.length;j++) {
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
    await client.query('DROP FUNCTION IF EXISTS opinion_v2_bench_sparse_slot(bytea, integer)');
    await client.end();
  }
}
run().catch(e => {
  console.error('Synthetic benchmark failed:', e.code || e.name || 'UNKNOWN');
  process.exitCode=1;
});
