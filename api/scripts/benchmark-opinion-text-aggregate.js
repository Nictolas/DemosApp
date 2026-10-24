'use strict';
/**
 * Compare 94 separate legacy TEXT aggregates with one grouped TEXT query.
 * Synthetic accounts only; existing synthetic ci_query_text from the prior
 * CI benchmark; writes only to localhost disposable opinion_bitset_ci.
 * Timing is indicative: no network latency, real traffic or caching.
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { buildTextAggregateQuery } = require('../utils/opinionTextAggregateProbe');
const N=1200;
const COLUMNS=Array.from({length:94},(_,i)=>'synthetic_opinion_'+String(i).padStart(3,'0'));
const DB='opinion_bitset_ci';
function guard(){
  if(process.env.OPINION_BENCH_EPHEMERAL!=='yes'||
    process.env.PGHOST!=='127.0.0.1'||
    process.env.PGDATABASE!==DB||process.env.PGUSER!=='postgres')
    throw Error('Refusing to access anything except ephemeral localhost PostgreSQL');
}
function uuid(i){return '00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0');}
function legacySQL(column,region){
  return `SELECT
 COUNT(*) FILTER (WHERE r."${column}"='f')::int AS favorevole,
 COUNT(*) FILTER (WHERE r."${column}"='c')::int AS contrario,
 COUNT(*) FILTER (WHERE r."${column}"='i')::int AS indeciso
 FROM ci_query_text r
 JOIN ci_opt_users u ON u.id=r.user_id
 LEFT JOIN ci_opt_consents uc ON uc.user_id=u.id
 WHERE r."${column}" IS NOT NULL
 AND u.account_type='PERSON'
 AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE
 ${region?'AND u.region=$1':''}`;
}
async function prepare(client){
  await client.query('CREATE TABLE ci_opt_users (id uuid PRIMARY KEY, account_type text NOT NULL, political_opinions_consent boolean, region text)');
  await client.query('CREATE TABLE ci_opt_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
  const rows=[];
  for(let i=1;i<=N;i++){
    const type=i<=10?'PERSON':i%17===0?'ORGANIZATION':'PERSON';
    const consent=i<=10?true:i%7===0?false:true;
    rows.push([uuid(i),type,consent,i<=10?'rare':'other']);
  }
  for(let off=0;off<N;off+=200){
    const args=[],parts=[];
    for(const row of rows.slice(off,off+200)){
      const start=args.length;args.push(...row);
      parts.push('($'+(start+1)+',$'+(start+2)+',$'+(start+3)+',$'+(start+4)+')');
    }
    await client.query('INSERT INTO ci_opt_users VALUES '+parts.join(','),args);
  }
  // Override legacy consent, including an eligible account whose override denies it.
  await client.query('INSERT INTO ci_opt_consents VALUES ($1,false),($2,true)',[uuid(20),uuid(21)]);
  // Make the ten rare-region accounts all answer opinion 0 explicitly.
  await client.query('UPDATE ci_query_text SET synthetic_opinion_000=\'f\' WHERE user_id=ANY($1::uuid[])',
    [Array.from({length:10},(_,i)=>uuid(i+1))]);
  await client.query('ANALYZE ci_query_text');
  await client.query('ANALYZE ci_opt_users');
}
function zero(){return {favorevole:0,contrario:0,indeciso:0};}
function published(row){return row.favorevole+row.contrario+row.indeciso>=10;}
async function compare(client,region){
  const params=region?['rare']:[];
  const baseline={};
  for(const col of COLUMNS){
    baseline[col]=(await client.query(legacySQL(col,region),params)).rows[0];
  }
  const grouped=(await client.query(buildTextAggregateQuery(COLUMNS,{region}),params)).rows;
  const actual=Object.fromEntries(grouped.map(r=>[r.opinion_id,{
    favorevole:r.favorevole,contrario:r.contrario,indeciso:r.indeciso
  }]));
  for(const col of COLUMNS){
    assert.deepEqual(actual[col]||zero(),baseline[col],'Mismatch for '+col);
    assert.equal(published(actual[col]||zero()),published(baseline[col]));
  }
  return {published:COLUMNS.filter(col=>published(baseline[col])).length,
    first:baseline[COLUMNS[0]]};
}
async function medianMs(client,sql,params){
  for(let i=0;i<3;i++)await client.query(sql,params);
  const times=[];
  for(let i=0;i<7;i++){
    const result=await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql,params);
    times.push(Number(result.rows[0]['QUERY PLAN'][0]['Execution Time']));
  }
  times.sort((a,b)=>a-b);return Number(times[3].toFixed(3));
}
async function main(){
  guard();
  const client=new Client({host:'127.0.0.1',port:Number(process.env.PGPORT||5432),
    database:DB,user:'postgres',password:process.env.PGPASSWORD,statement_timeout:30000});
  await client.connect();
  try{
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name,DB);
    await prepare(client);
    const global=await compare(client,false);
    const rareBefore=await compare(client,true);
    assert.deepEqual(rareBefore.first,{favorevole:10,contrario:0,indeciso:0});
    assert.equal(published(rareBefore.first),true);
    // Consent revocation must remove a previously public 10-person cell.
    await client.query('INSERT INTO ci_opt_consents VALUES ($1,false)',[uuid(1)]);
    const rareAfter=await compare(client,true);
    assert.deepEqual(rareAfter.first,{favorevole:9,contrario:0,indeciso:0});
    assert.equal(published(rareAfter.first),false);
    await client.query('DELETE FROM ci_opt_consents WHERE user_id=$1',[uuid(1)]);
    assert.deepEqual((await compare(client,true)).first,rareBefore.first);
    const groupedMs=await medianMs(client,buildTextAggregateQuery(COLUMNS,{}),[]);
    // Legacy endpoint runs 94 sequential queries. Measure all with EXPLAIN
    // (one representative sample per query); do not compare against just one.
    let legacyMs=0;
    for(const col of COLUMNS){
      const plan=(await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+legacySQL(col,false))).rows[0]['QUERY PLAN'][0];
      legacyMs+=Number(plan['Execution Time']);
    }
    const result={rows:N,opinions:COLUMNS.length,global,rareBefore,rareAfter,
      groupedMedianServerMs:groupedMs,legacy94SumServerMs:Number(legacyMs.toFixed(3)),
      warning:'Synthetic 1200-row server-only timings, no real client/network/Android; no production recommendation'};
    console.log('TEXT_AGGREGATE_COMPARISON_PASS');
    console.log('TEXT_AGGREGATE_RESULT_JSON='+JSON.stringify(result));
  }finally{await client.end();}
}
main().catch(e=>{console.error('TEXT aggregation comparison failed:',e);process.exitCode=1;});
