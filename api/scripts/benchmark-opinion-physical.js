'use strict';

/**
 * PHYSICAL Postgres benchmark, using SYNTHETIC data only.
 *
 * SAFETY BOUNDARY: this script can only connect to a disposable local
 * PostgreSQL database named opinion_bitset_ci on 127.0.0.1 when explicitly
 * enabled. Never pass production credentials or use Supabase for this script.
 *
 * Run via .github/workflows/opinion-bitset-prototype.yml.
 * Tests the real heap, primary index, TOAST and relation allocation, rather
 * than relying on pg_column_size(ROW(...)) proxies.
 */
const { Client } = require('pg');
const { encodeAnswers } = require('../utils/opinionBitset');
const { encodeTrimmed } = require('../utils/opinionTrimmedBitset');

const DB = 'opinion_bitset_ci';
const COUNT = 94;
const ROWS = 1200;
const RATES = [0, 0.05, 0.09, 0.33, 1];
const FORMATS = ['text', 'fixed', 'trimmed', 'jsonb'];
const OPINIONS = Array.from({ length: COUNT }, (_, i) => 'q' + i);
const SAFE_NAMES = OPINIONS.map((_, i) => 'q' + i);
const PHYSICAL_COLUMNS = OPINIONS.map((_, i) => 'opinion_' + String(i).padStart(3, '0') + '_synthetic_topic');

function assertDisposableDatabase() {
  if (process.env.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      process.env.PGHOST !== '127.0.0.1' ||
      process.env.PGDATABASE !== DB ||
      process.env.PGUSER !== 'postgres') {
    throw new Error('Refusing benchmark outside explicitly opted-in disposable localhost database');
  }
}

function makeRows(rate, sourceMode, salt) {
  // xorshift32: deterministic, not security-sensitive
  let state = (0x7a314ed9 ^ salt) >>> 0;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const rows = [];
  for (let i = 1; i <= ROWS; i++) {
    const answers = {};
    for (const id of SAFE_NAMES) {
      if (rand() < rate) {
        answers[id] = ['f', 'c', 'i'][Math.floor(rand() * 3)];
      }
    }
    let source = null;
    if (sourceMode === 'sources') {
      // Synthetic low-compressibility data, never user data.
      const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let body = '';
      for (let k = 0; k < 600; k++) body += alphabet[Math.floor(rand() * alphabet.length)];
      source = JSON.stringify({ reference: body, test: true });
    }
    rows.push({
      userId: '00000000-0000-4000-8000-' + i.toString(16).padStart(12, '0'),
      answers,
      source
    });
  }
  return rows;
}

function columnsFor(format) {
  const common = 'user_id uuid PRIMARY KEY, ';
  if (format === 'text') {
    return common + PHYSICAL_COLUMNS.map(name => name + ' text').join(', ') +
      ', fonti_opinioni jsonb';
  }
  if (format === 'jsonb') return common + 'opinions jsonb, fonti_opinioni jsonb';
  return common + 'opinions bytea, fonti_opinioni jsonb';
}

function makeParameters(row, format) {
  if (format === 'text') {
    return [row.userId, ...SAFE_NAMES.map(id => row.answers[id] || null), row.source];
  }
  if (format === 'fixed') {
    return [row.userId, encodeAnswers(SAFE_NAMES, row.answers), row.source];
  }
  if (format === 'trimmed') {
    return [row.userId, encodeTrimmed(SAFE_NAMES, row.answers), row.source];
  }
  // Use intentionally LONG synthetic keys resembling real-world opinion IDs.
  // Keeping q0..q93 in JSONB would unfairly favor this format.
  const obj = {};
  for (let i = 0; i < COUNT; i++) {
    if (row.answers[SAFE_NAMES[i]]) {
      obj[PHYSICAL_COLUMNS[i]] = row.answers[SAFE_NAMES[i]];
    }
  }
  return [row.userId, JSON.stringify(obj), row.source];
}

async function insertRows(client, table, format, rows) {
  const fields = format === 'text'
    ? ['user_id', ...PHYSICAL_COLUMNS, 'fonti_opinioni']
    : ['user_id', 'opinions', 'fonti_opinioni'];
  // Bounded parameter count, well under PostgreSQL's 65535 parameter cap.
  const batchSize = format === 'text' ? 45 : 200;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const args = [];
    const placeholders = [];
    for (const row of batch) {
      const values = makeParameters(row, format);
      const offset = args.length;
      args.push(...values);
      placeholders.push('(' + values.map((_, i) => '$' + (offset + i + 1)).join(',') + ')');
    }
    const sql = 'INSERT INTO ' + table + '(' + fields.join(',') + ') VALUES ' +
      placeholders.join(',');
    await client.query(sql, args);
  }
}

async function run() {
  assertDisposableDatabase();
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: DB,
    user: 'postgres',
    password: process.env.PGPASSWORD
  });
  await client.connect();
  try {
    const actual = await client.query('SELECT current_database() AS name, inet_server_addr()::text AS host');
    if (actual.rows[0].name !== DB ||
        !['127.0.0.1', '::1'].includes(actual.rows[0].host)) {
      throw new Error('Unexpected PostgreSQL target; refusing to create benchmark tables');
    }
    const results = [];
    for (const sourceMode of ['none', 'sources']) {
      for (const [index, rate] of RATES.entries()) {
        const rows = makeRows(rate, sourceMode, index + 23);
        for (const format of FORMATS) {
          const table = 'benchmark_' + sourceMode + '_' + index + '_' + format;
          await client.query('CREATE TABLE ' + table + ' (' + columnsFor(format) + ')');
          await insertRows(client, table, format, rows);
          const stats = await client.query(
            'SELECT pg_relation_size($1::regclass)::bigint AS heap, ' +
            'pg_indexes_size($1::regclass)::bigint AS indexes, ' +
            'pg_total_relation_size($1::regclass)::bigint AS total',
            [table]
          );
          const rowCount = await client.query('SELECT COUNT(*)::int AS count FROM ' + table);
          if (rowCount.rows[0].count !== ROWS) throw new Error('Row count mismatch in ' + table);
          const sizes = stats.rows[0];
          const heap = Number(sizes.heap);
          const indexes = Number(sizes.indexes);
          const total = Number(sizes.total);
          if (total < heap + indexes) throw new Error('Inconsistent PostgreSQL relation size');
          results.push({
            sources: sourceMode,
            density: rate,
            format,
            rows: ROWS,
            heap,
            indexes,
            toastAndMeta: total - heap - indexes,
            total,
            bytesPerRow: Number((total / ROWS).toFixed(2))
          });
        }
      }
    }
    console.log('PHYSICAL POSTGRES BENCHMARK — synthetic records, disposable local database only');
    console.log('PostgreSQL bytes include heap, indexes, TOAST, relation allocation; same UUID PK across formats.');
    console.table(results.map(x => ({
      source: x.sources,
      density: x.density,
      format: x.format,
      bytesPerRow: x.bytesPerRow,
      heap: x.heap,
      indexes: x.indexes,
      toastAndMeta: x.toastAndMeta
    })));
    const comparisons = [];
    for (const sourceMode of ['none', 'sources']) {
      for (const rate of RATES) {
        const group = results.filter(x => x.sources === sourceMode && x.density === rate);
        const baseline = group.find(x => x.format === 'text');
        for (const alternative of group.filter(x => x.format !== 'text')) {
          comparisons.push({
            source: sourceMode,
            density: rate,
            comparedToText: alternative.format,
            differenceBytesPerRow: Number(((baseline.total - alternative.total) / ROWS).toFixed(2)),
            projectionForMillionBytes: Math.round((baseline.total - alternative.total) * (1000000 / ROWS))
          });
        }
      }
    }
    console.log('POSITIVE difference means compact format saved total relation bytes vs TEXT.');
    console.log('One-million-account figures are LINEAR EXTRAPOLATIONS, not a load test.');
    console.table(comparisons);
    console.log('BENCHMARK_RESULT_JSON=' + JSON.stringify({ rowsPerTable: ROWS, results, comparisons }));
  } finally {
    await client.end();
  }
}

run().catch(error => {
  console.error('Physical benchmark failed:', error.message);
  process.exitCode = 1;
});
