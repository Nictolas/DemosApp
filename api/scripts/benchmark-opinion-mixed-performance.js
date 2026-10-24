'use strict';

/**
 * CI-only performance comparison with the 35%-sources synthetic tables
 * created by benchmark-opinion-mixed-sources.js (DOC-042).
 *
 * Measures local PostgreSQL + Node latency of normalized full reads,
 * single-slot reads, row-locked writes, and versioned catalog lookup.
 * All accounts and answers are fabricated. It does NOT exercise DEMOS
 * routes, network clients, authentication, Supabase, or monetary cost.
 *
 * Refuses any non-disposable database before connecting.
 */
const assert=require('node:assert/strict');
const { performance }=require('node:perf_hooks');
const { Client }=require('pg');
const {
  encodeAnswers, decodeAnswers, readAnswer, patchAnswers,
  catalogFingerprint, isAppendOnlyCatalog
}=require('../utils/opinionBitset');
const { decodeTrimmed, readTrimmed, patchTrimmed }=
  require('../utils/opinionTrimmedBitset');
const { decodeSparse, patchSparse }=require('../utils/opinionSparseBitset');

const DB='opinion_bitset_ci';
const N=824, SLOT_COUNT=94, READ_SAMPLES=120, WRITE_SAMPLES=72;
const IDS=Array.from({length:SLOT_COUNT},(_,i)=>'opinion'+i);
const COLUMNS=IDS.map((_,i)=>'synthetic_opinion_'+String(i).padStart(3,'0'));
const FINGERPRINT=catalogFingerprint(IDS);
const FORMATS=['text','fixed','trimmed','sparse',
  'sparse_versioned','sparse_envelope'];
const FORMAT_TABLE=Object.fromEntries(FORMATS.map(format=>
  [format,'ci_mixed_2_'+format]));
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
    e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
    e.PGDATABASE!==DB||e.PGUSER!=='postgres'||
    e.PGPASSWORD!=='synthetic-only'){
    throw Error('Refusing to benchmark any non-disposable PostgreSQL');
  }
}
const uuid=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const samples=Array.from({length:READ_SAMPLES},(_,i)=>({
  id:uuid(1+((i*37+11)%N)),slot:(i*17+3)%SLOT_COUNT
}));
const writes=Array.from({length:WRITE_SAMPLES},(_,i)=>({
  id:uuid(1+((i*37+29)%N)),
  slot:(i*29+7)%SLOT_COUNT,
  value:[null,'f','c','i'][i%4]
}));
function round(n){return Number(n.toFixed(3));}
function percentile(samples,p){
  const sorted=samples.slice().sort((a,b)=>a-b);
  return round(sorted[Math.ceil(sorted.length*p)-1]);
}
function stats(ms){return {
  n:ms.length,
  medianMs:percentile(ms,0.5),
  p95Ms:percentile(ms,0.95),
  meanMs:round(ms.reduce((sum,x)=>sum+x,0)/ms.length)
};}
function validateMeta(format,row){
  if(['sparse_versioned','sparse_envelope'].includes(format)){
    assert.equal(row.catalog_version,1,'Unexpected catalog version');
  }
  if(format==='sparse_envelope'){
    assert.equal(row.catalog_fingerprint,FINGERPRINT,
      'Unexpected ordered catalog fingerprint');
    assert.equal(row.encoding,'sparse','Unexpected codec name');
  }
}
function fullFields(format){
  if(format==='text')return COLUMNS.join(',');
  if(format==='sparse_envelope'){
    return 'opinions,catalog_version,catalog_fingerprint,encoding';
  }
  if(format==='sparse_versioned')return 'opinions,catalog_version';
  return 'opinions';
}
function unpack(format,row){
  if(format==='text'){
    return Object.fromEntries(IDS.map((id,i)=>[id,row[COLUMNS[i]]]));
  }
  validateMeta(format,row);
  if(format==='fixed')return decodeAnswers(IDS,row.opinions);
  if(format==='trimmed')return decodeTrimmed(IDS,row.opinions);
  return decodeSparse(IDS,row.opinions);
}
function singleAnswer(format,row,slot){
  if(format==='text')return row[COLUMNS[slot]];
  validateMeta(format,row);
  if(format==='fixed')return readAnswer(IDS,row.opinions,IDS[slot]);
  if(format==='trimmed')return readTrimmed(IDS,row.opinions,IDS[slot]);
  return decodeSparse(IDS,row.opinions)[IDS[slot]];
}
function patchPayload(format,payload,slot,value){
  const change={[IDS[slot]]:value};
  if(format==='fixed')return patchAnswers(IDS,payload,change);
  if(format==='trimmed')return patchTrimmed(IDS,payload,change);
  return patchSparse(IDS,payload,change);
}
async function prepare(client){
  const db=(await client.query(
    'SELECT current_database() db,current_user::text actor,'+
    'current_setting($1) version',['server_version_num'])).rows[0];
  assert.equal(db.db,DB);
  assert.equal(db.actor,'postgres');
  assert.equal(Math.floor(Number(db.version)/10000),17);
  for(const format of FORMATS){
    const table=FORMAT_TABLE[format];
    const exists=(await client.query(
      'SELECT to_regclass($1)::text AS relation',['public.'+table])).rows[0].relation;
    assert.equal(exists,table,'Expected DOC-042 synthetic fixture '+table);
    const count=(await client.query(
      'SELECT COUNT(*)::int n, COUNT(fonti_opinioni)::int with_sources FROM '+table
    )).rows[0];
    assert.equal(count.n,N);
    assert.equal(count.with_sources,288,'Not the expected 35%-source fixture');
    await client.query('ANALYZE '+table);
  }
  await client.query('CREATE TABLE ci_mixed_catalog_bench ('+
    'version integer PRIMARY KEY,ordered_ids jsonb NOT NULL,'+
    'fingerprint text NOT NULL)');
  const next=[...IDS,'opinion94'];
  assert.equal(isAppendOnlyCatalog(IDS,next),true);
  await client.query('INSERT INTO ci_mixed_catalog_bench VALUES'+
    '($1,$2::jsonb,$3),($4,$5::jsonb,$6)',[
      1,JSON.stringify(IDS),FINGERPRINT,
      2,JSON.stringify(next),catalogFingerprint(next)
    ]);
  const entries=(await client.query(
    'SELECT version,ordered_ids,fingerprint FROM ci_mixed_catalog_bench '+
    'ORDER BY version')).rows;
  assert.equal(entries.length,2);
  for(const row of entries){
    assert.equal(catalogFingerprint(row.ordered_ids),row.fingerprint);
  }
  assert.deepEqual(entries[0].ordered_ids,IDS);
  assert.equal(isAppendOnlyCatalog(entries[0].ordered_ids,entries[1].ordered_ids),true);
  return new Map(entries.map(row=>[row.version,row]));
}
async function benchmarkReads(client,format){
  const table=FORMAT_TABLE[format];
  const fullSql='SELECT '+fullFields(format)+' FROM '+table+
    ' WHERE user_id=$1';
  const oneSql=format==='text'?
    (slot)=>'SELECT '+COLUMNS[slot]+' FROM '+table+' WHERE user_id=$1':
    ()=>fullSql;
  const readFull=async s=>{
    const row=(await client.query(fullSql,[s.id])).rows[0];
    assert.ok(row,'Synthetic user must exist');
    const answers=unpack(format,row);
    assert.equal(Object.keys(answers).length,SLOT_COUNT);
    for(const value of Object.values(answers)){
      assert.ok(value===null||['f','c','i'].includes(value));
    }
  };
  const readOne=async s=>{
    const row=(await client.query(oneSql(s.slot),[s.id])).rows[0];
    assert.ok(row,'Synthetic user must exist');
    const value=singleAnswer(format,row,s.slot);
    assert.ok(value===null||['f','c','i'].includes(value));
  };
  for(const sample of samples.slice(0,10)){
    await readFull(sample);
    await readOne(sample);
  }
  const fullMs=[],singleMs=[];
  for(const sample of samples){
    const a=performance.now();
    await readFull(sample);
    fullMs.push(performance.now()-a);
    const b=performance.now();
    await readOne(sample);
    singleMs.push(performance.now()-b);
  }
  return {full:stats(fullMs),single:stats(singleMs)};
}
async function benchmarkWrites(client,format){
  const table=FORMAT_TABLE[format],isText=format==='text';
  const fields=fullFields(format);
  const expected=new Map(),times=[];
  const update=async sample=>{
    let begun=false;
    try{
      const start=performance.now();
      await client.query('BEGIN');
      begun=true;
      if(isText){
        const locked=(await client.query('SELECT user_id FROM '+table+
          ' WHERE user_id=$1 FOR UPDATE',[sample.id])).rows[0];
        assert.ok(locked);
        const result=await client.query('UPDATE '+table+' SET '+
          COLUMNS[sample.slot]+'=$1 WHERE user_id=$2',
          [sample.value,sample.id]);
        assert.equal(result.rowCount,1);
      }else{
        const locked=(await client.query('SELECT '+fields+' FROM '+table+
          ' WHERE user_id=$1 FOR UPDATE',[sample.id])).rows[0];
        assert.ok(locked);
        validateMeta(format,locked);
        const after=patchPayload(format,locked.opinions,sample.slot,sample.value);
        const result=await client.query(
          'UPDATE '+table+' SET opinions=$1 WHERE user_id=$2',
          [after,sample.id]);
        assert.equal(result.rowCount,1);
      }
      await client.query('COMMIT');
      begun=false;
      return performance.now()-start;
    }catch(err){
      if(begun)await client.query('ROLLBACK');
      throw err;
    }
  };
  // All runs mutate isolated format-specific CI tables, not shared benchmarks.
  for(const sample of writes.slice(0,8))await update(sample);
  for(const sample of writes){
    const elapsed=await update(sample);
    times.push(elapsed);
    expected.set(sample.id,{slot:sample.slot,value:sample.value});
  }
  for(const [id,{slot,value}] of expected.entries()){
    const row=(await client.query('SELECT '+fields+' FROM '+table+
      ' WHERE user_id=$1',[id])).rows[0];
    assert.equal(singleAnswer(format,row,slot),value);
  }
  return {transactional:stats(times),verifiedWrites:expected.size,
    protocol:isText?'BEGIN+lock row+UPDATE one TEXT column+COMMIT':
      'BEGIN+lock and fetch BYTEA+Node codec patch+UPDATE BYTEA+COMMIT'};
}
async function catalogCost(client,cache){
  const cached=[],uncached=[],lookups=READ_SAMPLES;
  const versions=Array.from({length:lookups},(_,i)=>i%7===0?2:1);
  // Warm the identical SQL lookup; no network requests.
  for(let i=0;i<12;i++){
    await client.query('SELECT ordered_ids,fingerprint FROM ci_mixed_catalog_bench '+
      'WHERE version=$1',[versions[i]]);
  }
  for(const version of versions){
    const a=performance.now();
    const val=cache.get(version);
    assert.equal(catalogFingerprint(val.ordered_ids),val.fingerprint);
    cached.push(performance.now()-a);
    const b=performance.now();
    const rows=(await client.query(
      'SELECT ordered_ids,fingerprint FROM ci_mixed_catalog_bench '+
      'WHERE version=$1',[version])).rows;
    assert.equal(rows.length,1);
    assert.equal(catalogFingerprint(rows[0].ordered_ids),rows[0].fingerprint);
    uncached.push(performance.now()-b);
  }
  const size=(await client.query(
    "SELECT pg_total_relation_size('ci_mixed_catalog_bench'::regclass)::bigint size"
  )).rows[0];
  return {cachedVersionLookupAndValidation:stats(cached),
    sqlVersionLookupAndValidation:stats(uncached),
    catalogVersions:2,catalogTableBytes:Number(size.size),
    note:'Cache includes SHA256 catalog validation (expensive if repeated); SQL includes local driver roundtrip. Not a production cache design.'};
}
async function codecCpu(client){
  const output={};
  const cycles=1000;
  const formats=['text','fixed','trimmed','sparse','sparse_versioned','sparse_envelope'];
  for(const format of formats){
    const table=FORMAT_TABLE[format];
    const row=(await client.query('SELECT '+fullFields(format)+' FROM '+table+
      ' WHERE user_id=$1',[samples[0].id])).rows[0];
    assert.ok(row);
    for(let n=0;n<30;n++)unpack(format,row);
    const start=process.hrtime.bigint();
    for(let n=0;n<cycles;n++){
      const all=unpack(format,row);
      assert.equal(Object.keys(all).length,SLOT_COUNT);
    }
    const elapsed=Number(process.hrtime.bigint()-start)/1e6;
    output[format]={cycles,msPerDecode:round(elapsed/cycles)};
  }
  return output;
}
async function main(){
  guard();
  const client=new Client({
    host:'127.0.0.1',port:5432,database:DB,
    user:'postgres',password:'synthetic-only',
    statement_timeout:25000,application_name:'ci_mixed_latency_247'
  });
  await client.connect();
  try{
    const cache=await prepare(client);
    const results=[];
    for(const format of FORMATS){
      const read=await benchmarkReads(client,format);
      const write=await benchmarkWrites(client,format);
      results.push({format,read,write});
    }
    const catalog=await catalogCost(client,cache);
    const cpu=await codecCpu(client);
    assert.equal(results.length,FORMATS.length);
    for(const r of results){
      assert.equal(r.read.full.n,READ_SAMPLES);
      assert.equal(r.read.single.n,READ_SAMPLES);
      assert.equal(r.write.transactional.n,WRITE_SAMPLES);
      assert.equal(r.write.verifiedWrites,WRITE_SAMPLES);
    }
    console.log('OPINION_MIXED_PERFORMANCE_PASS');
    console.log('OPINION_MIXED_PERFORMANCE_RESULT_JSON='+JSON.stringify({
      postgres:17,subjects:N,opinionSlots:SLOT_COUNT,
      inheritedMix:'moderate_sources',inheritedSourceCount:288,
      samples:{fullAndSingle:READ_SAMPLES,writes:WRITE_SAMPLES,
        codecCpuCycles:cpu.text.cycles},
      warmLocalPostgresOnly:true,
      reportIncludesClientDriverAndNodeDecoding:true,
      results,catalog,cpu,
      noProductionDbAccess:true,noProductionCodeIntegration:true,
      caveats:[
        'Synthetic fixture inherits an invented answer histogram and 35% source frequency.',
        'Read queries intentionally exclude source JSONB; not a full HTTP endpoint.',
        'No real network, concurrency, RLS or account consent; query p95 is not production p95.',
        'TEXT updates write one field, binary updates fetch and rewrite a complete payload.',
        'The catalog cached-vs-SQL comparison is illustrative; caching/invalidation require separate design.',
        'The relative performance varies with SQL page cache, Node JIT, load and runner hardware.',
        'No Supabase costs, capacity forecasts, release, schema migration or Android measurements.'
      ]
    }));
  }finally{
    await client.end();
  }
}
main().catch(error=>{
  console.error('Opinion mixed performance benchmark FAILED:',error);
  process.exitCode=1;
});
