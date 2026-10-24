'use strict';

/**
 * CI ONLY: synthetic PostgreSQL 17 physical storage sensitivity analysis.
 * Never connects to Supabase or production. Does not contain user records.
 *
 * Matches ONLY the observed summary of the legacy dataset (824 subjects,
 * 94 answer slots, about 8.32 filled per user, median 6, 508/824 with <8).
 * The detailed histogram, answered slots, source frequency, and source
 * lengths below are deliberately ILLUSTRATIVE, not sampled from real users.
 * Results show physical heap + indexes + TOAST, not server cost forecasts.
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { catalogFingerprint, encodeAnswers } = require('../utils/opinionBitset');
const { encodeTrimmed } = require('../utils/opinionTrimmedBitset');
const { encodeSparse } = require('../utils/opinionSparseBitset');

const DB='opinion_bitset_ci';
const COUNT=824;
const SLOT_COUNT=94;
const IDS=Array.from({length:SLOT_COUNT},(_,i)=>'opinion'+i);
const COLUMNS=IDS.map((_,i)=>'synthetic_opinion_'+String(i).padStart(3,'0'));
const FINGERPRINT=catalogFingerprint(IDS);
const MIXES=Object.freeze([
  { name:'no_sources', fraction:0 },
  { name:'rare_sources', fraction:0.10 },
  { name:'moderate_sources', fraction:0.35 },
  { name:'common_sources', fraction:0.75 },
  { name:'all_sources', fraction:1 }
]);
const FORMATS=Object.freeze([
  'text','fixed','trimmed','sparse','sparse_versioned','sparse_envelope'
]);

function strictGuard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||
      e.OPINION_BENCH_EPHEMERAL!=='yes'||
      e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
      e.PGDATABASE!==DB||e.PGUSER!=='postgres'||
      e.PGPASSWORD!=='synthetic-only'){
    throw Error('Mixed-source benchmark requires disposable GitHub Actions PostgreSQL only');
  }
}
function randFactory(seed){
  let state=seed>>>0;
  return ()=>{
    state^=state<<13;state^=state>>>17;state^=state<<5;
    return (state>>>0)/4294967296;
  };
}
function answeredCount(index){
  if(index<90)return 1;
  if(index<508)return 6;
  if(index<708)return 10;
  if(index<798)return index<722?19:18;
  return 24;
}
function syntheticRows(){
  const rows=[];
  for(let index=0;index<COUNT;index++){
    const count=answeredCount(index);
    const rand=randFactory(0x1a2325e9 ^ (index+1)*65537);
    const shuffled=Array.from({length:SLOT_COUNT},(_,i)=>i);
    for(let i=SLOT_COUNT-1;i>0;i--){
      const j=Math.floor(rand()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    const answers={};
    for(let j=0;j<count;j++){
      answers[IDS[shuffled[j]]]=['f','c','i'][Math.floor(rand()*3)];
    }
    rows.push({
      userId:'00000000-0000-4000-8000-'+(index+1).toString(16).padStart(12,'0'),
      answers,position:index
    });
  }
  const counts=rows.map(x=>Object.keys(x.answers).length).sort((a,b)=>a-b);
  const filled=counts.reduce((sum,n)=>sum+n,0);
  assert.equal(filled,6856);
  assert.equal(counts[411],6);
  assert.equal(counts[412],6);
  assert.equal(counts.filter(x=>x<8).length,508);
  return {rows,summary:{
    subjects:COUNT,slots:SLOT_COUNT,totalFilled:filled,
    meanFilled:Number((filled/COUNT).toFixed(3)),medianFilled:6,
    underEight:508,
    note:'Handcrafted histogram matches only known aggregate summaries; not an actual observed distribution'
  }};
}
function randomAscii(seed,length){
  const abc='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rand=randFactory(seed);
  let result='';
  for(let n=0;n<length;n++)result+=abc[Math.floor(rand()*abc.length)];
  return result;
}
function sourceFor(position,fraction){
  // Distinct deterministic selection, comparable across representations.
  if(((position*37+17)%100)>=fraction*100)return null;
  // 25% short (~140 chars), 50% medium (~700), 25% long (~1400).
  // These proportions are illustrative, not inferred from personal data.
  const size=[140,700,700,1400][position%4];
  return JSON.stringify({
    synthetic:true,reference:randomAscii(0x7182901 ^ (position+1)*131,size)
  });
}
function schema(format){
  const common='user_id uuid PRIMARY KEY, ';
  if(format==='text'){
    return common+COLUMNS.map(id=>id+' text').join(', ')+', fonti_opinioni jsonb';
  }
  let cols='opinions bytea NOT NULL';
  if(format==='sparse_versioned'||format==='sparse_envelope'){
    cols+=', catalog_version integer NOT NULL';
  }
  if(format==='sparse_envelope'){
    cols+=', catalog_fingerprint text NOT NULL, encoding text NOT NULL';
  }
  return common+cols+', fonti_opinioni jsonb';
}
function insertFields(format){
  if(format==='text')return ['user_id',...COLUMNS,'fonti_opinioni'];
  if(format==='sparse_envelope'){
    return ['user_id','opinions','catalog_version','catalog_fingerprint','encoding','fonti_opinioni'];
  }
  if(format==='sparse_versioned'){
    return ['user_id','opinions','catalog_version','fonti_opinioni'];
  }
  return ['user_id','opinions','fonti_opinioni'];
}
function values(format,row,source){
  if(format==='text'){
    return [row.userId,...IDS.map(id=>row.answers[id]??null),source];
  }
  const payload=format==='fixed'?encodeAnswers(IDS,row.answers):
    format==='trimmed'?encodeTrimmed(IDS,row.answers):
    encodeSparse(IDS,row.answers);
  if(format==='sparse_envelope'){
    return [row.userId,payload,1,FINGERPRINT,'sparse',source];
  }
  if(format==='sparse_versioned'){
    return [row.userId,payload,1,source];
  }
  return [row.userId,payload,source];
}
async function populate(client,table,format,rows,sources){
  const fields=insertFields(format);
  const batchSize=format==='text'?40:160;
  for(let off=0;off<COUNT;off+=batchSize){
    const args=[],placeholders=[];
    for(let i=off;i<Math.min(off+batchSize,COUNT);i++){
      const current=values(format,rows[i],sources[i]);
      const start=args.length;
      args.push(...current);
      placeholders.push('('+current.map((_,j)=>'$'+(start+j+1)).join(',')+')');
    }
    await client.query('INSERT INTO '+table+'('+fields.join(',')+') VALUES '+
      placeholders.join(','),args);
  }
}
async function physicalSize(client,table){
  const result=await client.query(
    'SELECT pg_relation_size($1::regclass)::bigint heap, '+
    'pg_indexes_size($1::regclass)::bigint indexes, '+
    'pg_total_relation_size($1::regclass)::bigint total',[table]
  );
  const heap=Number(result.rows[0].heap),
    indexes=Number(result.rows[0].indexes),total=Number(result.rows[0].total);
  assert.ok(total>=heap+indexes);
  const counts=await client.query(
    'SELECT COUNT(*)::int subjects, COUNT(fonti_opinioni)::int sources, '+
    'ROUND(AVG(pg_column_size(fonti_opinioni))::numeric,2) '+
    'source_bytes_when_present FROM '+table);
  assert.equal(counts.rows[0].subjects,COUNT);
  return {
    heap,indexes,toastAndMeta:total-heap-indexes,total,
    bytesPerAccount:Number((total/COUNT).toFixed(2)),
    sourceCount:counts.rows[0].sources,
    avgSourceBytesWhenPresent:counts.rows[0].source_bytes_when_present===null?
      null:Number(counts.rows[0].source_bytes_when_present)
  };
}
async function main(){
  strictGuard();
  const client=new Client({host:'127.0.0.1',port:5432,database:DB,
    user:'postgres',password:'synthetic-only',statement_timeout:30000,
    application_name:'ci_mixed_sources_physical_247'});
  await client.connect();
  try{
    const identity=(await client.query(
      'SELECT current_database() db,current_user::text actor')).rows[0];
    assert.deepEqual(identity,{db:DB,actor:'postgres'});
    const sample=syntheticRows(),results=[],comparisons=[];
    for(let mi=0;mi<MIXES.length;mi++){
      const mix=MIXES[mi];
      const sources=sample.rows.map(r=>sourceFor(r.position,mix.fraction));
      const expectedSourceCount=sources.filter(x=>x!==null).length;
      const group=[];
      for(const format of FORMATS){
        const table='ci_mixed_'+mi+'_'+format;
        await client.query('CREATE TABLE '+table+' ('+schema(format)+')');
        await populate(client,table,format,sample.rows,sources);
        const physical=await physicalSize(client,table);
        assert.equal(physical.sourceCount,expectedSourceCount);
        group.push({mix:mix.name,requestedSourceFraction:mix.fraction,
          format,...physical});
      }
      assert.equal(group.length,FORMATS.length);
      const baseline=group[0];
      for(const row of group){
        assert.equal(row.sourceCount,baseline.sourceCount);
        assert.equal(row.avgSourceBytesWhenPresent,
          baseline.avgSourceBytesWhenPresent);
        comparisons.push({
          mix:mix.name,format:row.format,
          baselineTextBytesPerAccount:baseline.bytesPerAccount,
          candidateBytesPerAccount:row.bytesPerAccount,
          savedBytesPerAccount:Number(
            ((baseline.total-row.total)/COUNT).toFixed(2)),
          savedPercent:Number(
            (100*(baseline.total-row.total)/baseline.total).toFixed(2))
        });
      }
      results.push(...group);
    }
    // Full envelope has a real per-user cost. It cannot be silently omitted
    // when deciding on a production design with version/fingerprint fields.
    assert.equal(results.length,MIXES.length*FORMATS.length);
    console.log('OPINION_MIXED_SOURCES_PHYSICAL_PASS');
    console.log('OPINION_MIXED_SOURCES_RESULT_JSON='+JSON.stringify({
      postgres:17,sample:sample.summary,
      sourceModel:{
        frequencies:MIXES,
        sizes:[140,700,700,1400],
        description:'Hypothetical short/medium/long low-compressibility source text, same sources for all formats'
      },
      formats:FORMATS,
      includesCatalogMetadataVariants:['sparse_versioned','sparse_envelope'],
      results,comparisons,
      noRealUsers:true,noSupabaseAccess:true,
      warnings:[
        'Physical size includes heap, index, TOAST and relation allocation for 824 synthetic accounts.',
        'Source frequencies, sizes, answer locations and answer histogram are hypothetical.',
        'No realistic server CPU, query latency, Android, RLS, rollback, catalog table, or monetary cost measured.',
        'No migration or deployment; no prediction of Free tier capacity or one-million-user availability.'
      ]
    }));
  }finally{
    await client.end();
  }
}
main().catch(error=>{
  console.error('Mixed-source physical benchmark FAILED:',error);
  process.exitCode=1;
});
