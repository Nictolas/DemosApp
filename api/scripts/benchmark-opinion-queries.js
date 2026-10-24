'use strict';

/**
 * Ephemeral PostgreSQL test for one-opinion statistics and concurrent writes.
 * Only connects to localhost opinion_bitset_ci, with an explicit opt-in.
 * All values and UUIDs are synthetic; NO Supabase or real user data.
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { encodeAnswers } = require('../utils/opinionBitset');
const { encodeTrimmed } = require('../utils/opinionTrimmedBitset');
const { encodeSparse, decodeSparse, patchSparse } = require('../utils/opinionSparseBitset');

const DB = 'opinion_bitset_ci';
const N = 1200;
const IDS = Array.from({ length: 94 }, (_, i) => 'q' + i);
const COLUMNS = IDS.map((_, i) => 'synthetic_opinion_' + String(i).padStart(3, '0'));
const TYPES = ['text', 'fixed', 'trimmed', 'sparse'];
function guard() {
  if (process.env.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      process.env.PGHOST !== '127.0.0.1' ||
      process.env.PGDATABASE !== DB || process.env.PGUSER !== 'postgres') {
    throw new Error('Refusing SQL outside disposable local GitHub Actions PostgreSQL');
  }
}
function connection() {
  return new Client({
    host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
    database: DB, user: 'postgres', password: process.env.PGPASSWORD,
    statement_timeout: 10000
  });
}
function sample() {
  let seed = 0x54de3091;
  function random() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }
  return Array.from({ length: N }, (_, i) => {
    const answers = {};
    for (const id of IDS) {
      if (random() < 0.09) answers[id] = ['f', 'c', 'i'][Math.floor(random() * 3)];
    }
    return { uuid: '00000000-0000-4000-8000-' + (i + 1).toString(16).padStart(12, '0'), answers };
  });
}
function values(type, row) {
  if (type === 'text') return [row.uuid, ...IDS.map(id => row.answers[id] || null)];
  if (type === 'fixed') return [row.uuid, encodeAnswers(IDS, row.answers)];
  if (type === 'trimmed') return [row.uuid, encodeTrimmed(IDS, row.answers)];
  return [row.uuid, encodeSparse(IDS, row.answers)];
}
async function prepare(client, type, rows) {
  const table = 'ci_query_' + type;
  const fields = type === 'text' ? ['user_id', ...COLUMNS] : ['user_id', 'opinions'];
  const create = type === 'text'
    ? 'user_id uuid PRIMARY KEY, ' + COLUMNS.map(c => c + ' text').join(', ')
    : 'user_id uuid PRIMARY KEY, opinions bytea NOT NULL, revision int NOT NULL DEFAULT 0';
  await client.query('CREATE TABLE ' + table + ' (' + create + ')');
  const batchSize = type === 'text' ? 45 : 200;
  for (let off = 0; off < rows.length; off += batchSize) {
    const args = [];
    const tuples = [];
    for (const row of rows.slice(off,off+batchSize)) {
      const valuesForRow = values(type,row);
      const start = args.length;
      args.push(...valuesForRow);
      tuples.push('(' + valuesForRow.map((_, i) => '$' + (start+i+1)).join(',') + ')');
    }
    await client.query('INSERT INTO ' + table + '(' + fields.join(',') + ') VALUES ' + tuples.join(','), args);
  }
  await client.query('ANALYZE ' + table);
}
const SPARSE_FUNCTION = [
  'CREATE FUNCTION ci_sparse_code(payload bytea, slot_index integer)',
  'RETURNS integer LANGUAGE plpgsql IMMUTABLE STRICT AS $body$',
  'DECLARE pos integer := -1; b integer; gap integer; code integer; j integer;',
  'BEGIN',
  '  IF slot_index < 0 THEN RAISE EXCEPTION \'negative index\'; END IF;',
  '  IF octet_length(payload) = 0 THEN RETURN 0; END IF;',
  '  FOR j IN 0..octet_length(payload)-1 LOOP',
  '    b := get_byte(payload,j); gap := b >> 2; code := b & 3;',
  '    IF gap=0 OR (code=0 AND gap<>63) THEN RAISE EXCEPTION \'invalid sparse byte\'; END IF;',
  '    pos := pos + gap;',
  '    IF pos=slot_index AND code<>0 THEN RETURN code; END IF;',
  '    IF pos>slot_index THEN RETURN 0; END IF;',
  '  END LOOP;',
  '  RETURN 0;',
  'END',
  '$body$'
].join('\n');
function expression(type,index) {
  if (type === 'text') return COLUMNS[index];
  if (type === 'sparse') return 'ci_sparse_code(opinions,'+index+')';
  const byteIndex=Math.floor(index/4);
  const shift=6-2*(index%4);
  return '(CASE WHEN octet_length(opinions)>'+byteIndex+
    ' THEN (get_byte(opinions,'+byteIndex+') >> '+shift+') & 3 ELSE 0 END)';
}
function countQuery(type,index) {
  const exp=expression(type,index);
  const codes=type==='text' ? ["'f'","'c'","'i'"] : [1,2,3];
  return 'SELECT COUNT(*) FILTER(WHERE '+exp+'='+codes[0]+')::int AS f, '+
    'COUNT(*) FILTER(WHERE '+exp+'='+codes[1]+')::int AS c, '+
    'COUNT(*) FILTER(WHERE '+exp+'='+codes[2]+')::int AS i, '+
    'COUNT(*) FILTER(WHERE '+(type==='text'?exp+' IS NULL':exp+'=0')+
    ')::int AS missing FROM ci_query_'+type;
}
function materializedSparseQuery(index) {
  return 'WITH answers AS MATERIALIZED (' +
    'SELECT ci_sparse_code(opinions,'+index+') AS response_code FROM ci_query_sparse' +
    ') SELECT COUNT(*) FILTER (WHERE response_code=1)::int AS f, ' +
    'COUNT(*) FILTER (WHERE response_code=2)::int AS c, ' +
    'COUNT(*) FILTER (WHERE response_code=3)::int AS i, ' +
    'COUNT(*) FILTER (WHERE response_code=0)::int AS missing FROM answers';
}
async function validateQueries(client) {
  const checks=[];
  const times=[];
  for (const index of [0,3,14,45,63,93]) {
    const expected=(await client.query(countQuery('text',index))).rows[0];
    assert.equal(expected.f+expected.c+expected.i+expected.missing,N);
    for (const type of TYPES) {
      const query=countQuery(type,index);
      assert.deepEqual((await client.query(query)).rows[0], expected,
        'Stats mismatch type='+type+' slot='+index);
      if(type==='sparse') {
        const materialized=materializedSparseQuery(index);
        assert.deepEqual((await client.query(materialized)).rows[0],expected,
          'Sparse materialized aggregate mismatch slot='+index);
      }
      if (![0,45,93].includes(index)) continue;
      for(let n=0;n<3;n++) await client.query(query);
      const ms=[];
      for(let n=0;n<9;n++) {
        const plan=(await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+query)).rows[0]['QUERY PLAN'][0];
        ms.push(Number(plan['Execution Time']));
      }
      ms.sort((a,b)=>a-b);
      times.push({slot:index,type,medianServerMs:Number(ms[4].toFixed(3))});
      if(type==='sparse') {
        const fastQuery=materializedSparseQuery(index);
        for(let n=0;n<3;n++) await client.query(fastQuery);
        const improved=[];
        for(let n=0;n<9;n++) {
          const plan=(await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+fastQuery)).rows[0]['QUERY PLAN'][0];
          improved.push(Number(plan['Execution Time']));
        }
        improved.sort((a,b)=>a-b);
        times.push({slot:index,type:'sparse_materialized',medianServerMs:Number(improved[4].toFixed(3))});
      }
    }
    checks.push({slot:index,stats:expected});
  }
  return {checks,times};
}
async function lockTest() {
  const a=connection(),b=connection(),verify=connection();
  await Promise.all([a.connect(),b.connect(),verify.connect()]);
  const id='00000000-0000-4000-8000-000000000001';
  try {
    await verify.query('UPDATE ci_query_sparse SET opinions=$1,revision=0 WHERE user_id=$2',[encodeSparse(IDS,{}),id]);
    await a.query('BEGIN');
    await b.query('BEGIN');
    const aRead=(await a.query('SELECT opinions,revision FROM ci_query_sparse WHERE user_id=$1 FOR UPDATE',[id])).rows[0];
    const bWait=b.query('SELECT opinions,revision FROM ci_query_sparse WHERE user_id=$1 FOR UPDATE',[id]);
    await a.query('UPDATE ci_query_sparse SET opinions=$1,revision=revision+1 WHERE user_id=$2',
      [patchSparse(IDS,aRead.opinions,{q0:'f'}),id]);
    await a.query('COMMIT');
    const bRead=(await bWait).rows[0];
    assert.equal(bRead.revision,1);
    await b.query('UPDATE ci_query_sparse SET opinions=$1,revision=revision+1 WHERE user_id=$2',
      [patchSparse(IDS,bRead.opinions,{q93:'c'}),id]);
    await b.query('COMMIT');
    const final=(await verify.query('SELECT opinions,revision FROM ci_query_sparse WHERE user_id=$1',[id])).rows[0];
    const answers=decodeSparse(IDS,final.opinions);
    assert.equal(final.revision,2);
    assert.equal(answers.q0,'f');
    assert.equal(answers.q93,'c');
  } catch(e) {
    await Promise.allSettled([a.query('ROLLBACK'),b.query('ROLLBACK')]);
    throw e;
  } finally {
    await Promise.allSettled([a.end(),b.end(),verify.end()]);
  }
  return true;
}
async function casTest(client) {
  const id='00000000-0000-4000-8000-000000000002';
  await client.query('UPDATE ci_query_sparse SET opinions=$1,revision=0 WHERE user_id=$2',[encodeSparse(IDS,{}),id]);
  const snap=(await client.query('SELECT opinions,revision FROM ci_query_sparse WHERE user_id=$1',[id])).rows[0];
  const first=patchSparse(IDS,snap.opinions,{q2:'i'});
  const stale=patchSparse(IDS,snap.opinions,{q90:'c'});
  const casSql='UPDATE ci_query_sparse SET opinions=$1,revision=revision+1 WHERE user_id=$2 AND revision=$3';
  assert.equal((await client.query(casSql,[first,id,snap.revision])).rowCount,1);
  assert.equal((await client.query(casSql,[stale,id,snap.revision])).rowCount,0);
  const fresh=(await client.query('SELECT opinions,revision FROM ci_query_sparse WHERE user_id=$1',[id])).rows[0];
  assert.equal((await client.query(casSql,[patchSparse(IDS,fresh.opinions,{q90:'c'}),id,fresh.revision])).rowCount,1);
  const final=(await client.query('SELECT opinions,revision FROM ci_query_sparse WHERE user_id=$1',[id])).rows[0];
  const answers=decodeSparse(IDS,final.opinions);
  assert.equal(final.revision,2);
  assert.equal(answers.q2,'i');
  assert.equal(answers.q90,'c');
  return true;
}
async function main() {
  guard();
  const client=connection();
  await client.connect();
  try {
    if ((await client.query('SELECT current_database() AS name')).rows[0].name!==DB) {
      throw new Error('Unexpected database');
    }
    const rows=sample();
    for (const type of TYPES) await prepare(client,type,rows);
    await client.query(SPARSE_FUNCTION);
    const query=await validateQueries(client);
    const locks=await lockTest();
    const cas=await casTest(client);
    console.log('CI QUERY & CONCURRENCY PASS: f/c/i/NULL stats equal across all codecs');
    console.log('EXPLAIN server times are indicative, not production SLA.');
    console.table(query.times);
    console.log('OPINION_QUERY_RESULT_JSON='+JSON.stringify({rows:N,query,locks,cas}));
  } finally {
    await client.end();
  }
}
main().catch(e=>{console.error('Opinion query test failed:',e.message);process.exitCode=1;});
