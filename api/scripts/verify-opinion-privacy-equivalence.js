'use strict';

/**
 * CI-only privacy/consent equivalence checks for candidate opinion formats.
 * Uses TEMP tables and synthetic rows on the disposable GitHub Actions DB.
 * Never accesses Supabase or personal opinion data.
 *
 * Models real DEMOS route conditions:
 *  - only u.account_type = 'PERSON'
 *  - COALESCE(uc.political_opinions_consent,
 *             u.political_opinions_consent, false) IS TRUE
 *  - NULL/unanswered excluded
 *  - 10-or-more respondent threshold, including geographic segments
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { patchAnswers } = require('../utils/opinionBitset');
const { patchTrimmed } = require('../utils/opinionTrimmedBitset');
const { patchSparse } = require('../utils/opinionSparseBitset');
const {
  MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE,
  cellThresholdMet
} = require('../utils/politicalAggregatePrivacy');

const DB='opinion_bitset_ci';
const FORMATS=['text','fixed','trimmed','sparse'];
const IDS=Array.from({length:94},(_,i)=>'q'+i);
function checkTarget() {
  if(process.env.OPINION_BENCH_EPHEMERAL!=='yes'||
    process.env.PGHOST!=='127.0.0.1'||
    process.env.PGDATABASE!==DB||process.env.PGUSER!=='postgres') {
    throw new Error('CI-only disposable localhost PostgreSQL required');
  }
}
function uuid(i) {
  return '00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0');
}
function makeClient() {
  return new Client({
    host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),
    database:DB,user:'postgres',password:process.env.PGPASSWORD,
    statement_timeout:10000
  });
}
function userRow(i) {
  // 1..9: exactly nine consented respondents, to be SUPPRESSED.
  // 10..19: exactly ten consented respondents, to be PUBLISHED.
  // 20..23: extra answered rows in rare9, all ineligible for different reasons.
  // 25: explicit NULL answer in rare10; it must not raise the count.
  let region = i<=9||i>=20&&i<=23 ? 'rare9' :
    i<=19||i===25 ? 'rare10' : (i%2===0?'north':'south');
  const special=i<=19;
  let accountType=special?'PERSON':(i%17===0?'INSTITUTION':(i%11===0?'ORGANIZATION':'PERSON'));
  let consent=special?true:i%5===0?null:i%3!==0;
  let consentOverride=null;
  if(i===20){accountType='ORGANIZATION';consent=true;}
  if(i===21){accountType='PERSON';consent=false;}
  if(i===22){accountType='PERSON';consent=true;consentOverride=false;}
  if(i===23){accountType='PERSON';consent=null;}
  if(i===24){accountType='PERSON';consent=false;consentOverride=true;}
  if(i===25){accountType='PERSON';consent=true;}
  if(i>25&&i%7===0) consentOverride=false;
  if(i>25&&i%13===0) consentOverride=true;
  const gender=i%3===0?'d':i%3===1?'u':null;
  const createConsentRow= i===22||i===24||
    (i>25&&i%4===0);
  return {id:uuid(i),region,gender,accountType,consent,
    consentOverride,createConsentRow};
}
async function createTables(client) {
  await client.query('CREATE TEMP TABLE ci_privacy_users ('+
    'id uuid PRIMARY KEY, account_type text NOT NULL,'+
    'political_opinions_consent boolean,regione_residenza text,genere text)');
  await client.query('CREATE TEMP TABLE ci_privacy_consents ('+
    'user_id uuid PRIMARY KEY,political_opinions_consent boolean)');
  for(const type of FORMATS){
    await client.query('CREATE TEMP TABLE ci_privacy_'+type+
      ' AS SELECT * FROM ci_query_'+type);
  }
}
async function insertUsers(client) {
  const people=Array.from({length:1200},(_,i)=>userRow(i+1));
  for(let off=0;off<people.length;off+=120) {
    const args=[],tuples=[];
    for(const p of people.slice(off,off+120)){
      const n=args.length;
      args.push(p.id,p.accountType,p.consent,p.region,p.gender);
      tuples.push('('+[1,2,3,4,5].map(i=>'$'+(n+i)).join(',')+')');
    }
    await client.query(
      'INSERT INTO ci_privacy_users (id,account_type,political_opinions_consent,regione_residenza,genere) VALUES '+
      tuples.join(','),args);
  }
  const override=people.filter(p=>p.createConsentRow);
  for(let off=0;off<override.length;off+=200) {
    const args=[],tuples=[];
    for(const p of override.slice(off,off+200)){
      const n=args.length;
      args.push(p.id,p.consentOverride);
      tuples.push('($'+(n+1)+',$'+(n+2)+')');
    }
    await client.query(
      'INSERT INTO ci_privacy_consents (user_id,political_opinions_consent) VALUES '+
      tuples.join(','),args);
  }
  return people;
}
async function setAnswer(client,id,newValue) {
  await client.query(
    'UPDATE ci_privacy_text SET synthetic_opinion_000=$1 WHERE user_id=$2',
    [newValue,id]);
  for(const type of ['fixed','trimmed','sparse']){
    const table='ci_privacy_'+type;
    const old=(await client.query(
      'SELECT opinions FROM '+table+' WHERE user_id=$1',[id])).rows[0].opinions;
    const changed = type==='fixed'?patchAnswers(IDS,old,{q0:newValue}):
      type==='trimmed'?patchTrimmed(IDS,old,{q0:newValue}):
      patchSparse(IDS,old,{q0:newValue});
    await client.query('UPDATE '+table+' SET opinions=$1 WHERE user_id=$2',
      [changed,id]);
  }
}
async function setBoundaryCases(client) {
  // 1..23 all explicitly answered q0=f; 20..23 must be ineligible.
  for(let i=1;i<=23;i++)await setAnswer(client,uuid(i),'f');
  // The 25th account is eligible but unanswered in rare10.
  await setAnswer(client,uuid(25),null);
}
function expression(type,index) {
  if(type==='text')return 'r.synthetic_opinion_'+String(index).padStart(3,'0');
  if(type==='sparse')return 'ci_sparse_code(r.opinions,'+index+')';
  const byteIndex=Math.floor(index/4),shift=6-2*(index%4);
  return '(CASE WHEN octet_length(r.opinions)>'+byteIndex+
    ' THEN ((get_byte(r.opinions,'+byteIndex+') >> '+shift+') & 3) ELSE 0 END)';
}
function queryFor(type,index,scope,publishedOnly){
  const exp=expression(type,index);
  const isText=type==='text';
  const qualifies=isText ? 'opinion_val IS NOT NULL':'opinion_val<>0';
  const codes=isText?["'f'","'c'","'i'"]:[1,2,3];
  const region=scope==='regions'?',regione_residenza':'';
  const group=scope==='regions'?'GROUP BY regione_residenza':'';
  const selectRegion=scope==='regions'?'regione_residenza, ':'';
  const having=publishedOnly?' HAVING COUNT(*) >= '+
    MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE:'';
  return 'WITH eligible AS MATERIALIZED ('+
    'SELECT '+exp+' AS opinion_val'+region+
    ' FROM ci_privacy_'+type+' r'+
    ' JOIN ci_privacy_users u ON u.id=r.user_id'+
    ' LEFT JOIN ci_privacy_consents uc ON uc.user_id=u.id'+
    " WHERE u.account_type='PERSON'"+
    ' AND COALESCE(uc.political_opinions_consent,'+
    'u.political_opinions_consent,false) IS TRUE'+
    ') SELECT '+selectRegion+
    'COUNT(*)::int AS totale, '+
    'COUNT(*) FILTER (WHERE opinion_val='+codes[0]+')::int AS favorevole, '+
    'COUNT(*) FILTER (WHERE opinion_val='+codes[1]+')::int AS contrario, '+
    'COUNT(*) FILTER (WHERE opinion_val='+codes[2]+')::int AS indeciso '+
    'FROM eligible WHERE '+qualifies+' '+group+having+
    (scope==='regions'?' ORDER BY regione_residenza':'');
}
function responseOf(row) {
  return {favorevole:row.favorevole,contrario:row.contrario,indeciso:row.indeciso};
}
async function compareAll(client) {
  const checks=[];
  for(const slot of [0,3,14,45,63,93]){
    for(const scope of ['all','regions']){
      const published=scope==='regions';
      const baseline=(await client.query(queryFor('text',slot,scope,published))).rows;
      for(const type of FORMATS.slice(1)){
        const actual=(await client.query(queryFor(type,slot,scope,published))).rows;
        assert.deepEqual(actual,baseline,
          'Consent/region/threshold mismatch '+type+' '+scope+' '+slot);
      }
      checks.push({slot,scope,returnedRows:baseline.length});
      if(slot===0 && scope==='regions'){
        const regions=Object.fromEntries(baseline.map(x=>[x.regione_residenza,x]));
        assert.equal(regions.rare9,undefined,
          '9 respondents must be absent from published results');
        assert.equal(regions.rare10?.totale,10,
          'exactly 10 eligible respondents must remain visible');
        assert.equal(regions.rare10?.favorevole,10);
      }
    }
  }
  // Check direct public suppression rule separately from SQL HAVING,
  // including 0, 9 and 10, and demonstrate invalid non-person rows did not leak.
  const raw=(await client.query(queryFor('text',0,'regions',false))).rows;
  const byRegion=Object.fromEntries(raw.map(x=>[x.regione_residenza,x]));
  assert.equal(byRegion.rare9?.totale,9);
  assert.equal(byRegion.rare10?.totale,10);
  assert.equal(cellThresholdMet(responseOf(byRegion.rare9)),false);
  assert.equal(cellThresholdMet(responseOf(byRegion.rare10)),true);
  assert.equal(cellThresholdMet({favorevole:0,contrario:0,indeciso:0}),false);
  assert.equal(MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE,10);
  return {checks,thresholds:{rare9Suppressed:true,rare10Published:true},
    consentAndAccountFilters:true};
}
async function main(){
  checkTarget();
  const client=makeClient();
  await client.connect();
  try{
    const target=(await client.query('SELECT current_database() name')).rows[0].name;
    assert.equal(target,DB);
    await createTables(client);
    await insertUsers(client);
    await setBoundaryCases(client);
    const result=await compareAll(client);
    console.log('CI POLITICAL CONSENT & PRIVACY PASS: all formats equivalent, threshold 9 suppressed/10 shown');
    console.log('OPINION_PRIVACY_RESULT_JSON='+JSON.stringify(result));
  }finally{await client.end();}
}
main().catch(e=>{console.error('Privacy equivalence failed:',e.message);process.exitCode=1;});
