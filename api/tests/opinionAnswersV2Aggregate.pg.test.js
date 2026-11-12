'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {
  buildHybridSurveyAggregateQuery,publishHybridSurveyStats,
  projectHybridMatchingMaps
}=require('../experiments/opinionAnswersV2AggregateCandidate');

/**
 * PostgreSQL 17 disposable fixture only; NEVER touches live DEMOS tables.
 * Checks consent precedence and account filtering, old TEXT + future JSONB
 * questions, regions/provinces/municipalities, and 10 -> 9 suppression.
 */
const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const legacy=['opinione_0','opinione_1'];
const published=new Set(['opinione_0','opinione_1','opinione_94','opinione_95']);
const tables=['ci_hybrid_agg_answers','ci_hybrid_agg_consents','ci_hybrid_agg_users'];
function disposable(){
  if(!enabled)throw Error('Disposable CI only');
  const u=new URL(uri);
  if(!['127.0.0.1','localhost','::1'].includes(u.hostname)||
      u.pathname!=='/opinion_answers_ci'){
    throw Error('Refusing nonlocal PostgreSQL database');
  }
}
async function stats(db,ids,scope,scopeValues){
  const built=buildHybridSurveyAggregateQuery({
    opinionIds:ids,publishedIds:published,legacyIds:legacy,scope,scopeValues
  });
  const sql=built.sql
    .replaceAll('FROM opinioni_risposte orr','FROM ci_hybrid_agg_answers orr')
    .replaceAll('JOIN users u','JOIN ci_hybrid_agg_users u')
    .replaceAll('JOIN user_consents uc','JOIN ci_hybrid_agg_consents uc');
  const result=await db.query(sql,built.params);
  return publishHybridSurveyStats(result.rows,published);
}
async function drop(db){
  for(const table of tables)await db.query('DROP TABLE IF EXISTS '+table);
}
test('PG17 hybrid Sondaggi: consent, geography, privacy threshold and matching',
  {skip:!enabled},async t=>{
    disposable();
    const db=new Client({connectionString:uri,connectionTimeoutMillis:5000});
    await db.connect();
    try{
      await drop(db);
      await db.query(
        'CREATE TABLE ci_hybrid_agg_users ('+
        'id uuid PRIMARY KEY,account_type text NOT NULL,'+
        'political_opinions_consent boolean NOT NULL,'+
        'regione_residenza text,provincia_residenza text,comune_residenza text)'
      );
      await db.query(
        'CREATE TABLE ci_hybrid_agg_consents ('+
        'user_id uuid PRIMARY KEY REFERENCES ci_hybrid_agg_users(id),'+
        'political_opinions_consent boolean)'
      );
      await db.query(
        'CREATE TABLE ci_hybrid_agg_answers ('+
        'user_id uuid PRIMARY KEY REFERENCES ci_hybrid_agg_users(id),'+
        '"opinione_0" text,"opinione_1" text,'+
        "answers_extra jsonb NOT NULL DEFAULT '{}'::jsonb,"+
        "fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb)"
      );
      // Ten consenting people in Livorno, one consenting person in Rome.
      // Person 2: base false, explicit true (consent override INCLUDED).
      // Person 12: base true, explicit false (override EXCLUDED).
      // Person 13: compact O organization (EXCLUDED); even persons use P.
      for(let i=1;i<=13;i++){
        const account=i===13?'O':(i%2===0?'P':'PERSON');
        const base=i!==2;
        const region=i===11?'Lazio':'Toscana';
        const province=i===11?'Roma':'Livorno';
        const comune=i===11?'Roma':'Livorno';
        await db.query(
          'INSERT INTO ci_hybrid_agg_users VALUES($1,$2,$3,$4,$5,$6)',
          [uid(i),account,base,region,province,comune]
        );
        // A pure-favorable 10/11-person group is statically publishable.
        // A separate test injects one minority response to assert suppression.
        const old='f';
        const future='f';
        // Three responses on the 96th question, always under threshold.
        const extra={
          opinione_94:future,
          opinione_archived:'i'
        };
        if(i<=3)extra.opinione_95='f';
        await db.query(
          'INSERT INTO ci_hybrid_agg_answers(user_id,"opinione_0",answers_extra,fonti_opinioni) '+
          'VALUES($1,$2,$3::jsonb,$4::jsonb)',
          [uid(i),old,JSON.stringify(extra),JSON.stringify({opinione_0:'synthetic'})]
        );
      }
      await db.query('INSERT INTO ci_hybrid_agg_consents VALUES($1,true),($2,false)',
        [uid(2),uid(12)]);

      await t.test('compact P and legacy PERSON both count; O never counts',async()=>{
        const grouped=await db.query(
          'SELECT account_type,COUNT(*)::int AS n FROM ci_hybrid_agg_users '+
          'GROUP BY account_type ORDER BY account_type'
        );
        assert.deepEqual(grouped.rows.map(r=>[r.account_type,r.n]),[
          ['O',1],['P',6],['PERSON',6]
        ]);
        const publishedCounts=await stats(db,['opinione_0','opinione_94']);
        assert.equal(Object.values(publishedCounts.opinione_0).reduce((a,b)=>a+b,0),11);
        assert.equal(Object.values(publishedCounts.opinione_94).reduce((a,b)=>a+b,0),11);
      });
      await t.test('national totals include old and future, suppress 96th',async()=>{
        const result=await stats(db,['opinione_0','opinione_94','opinione_95']);
        assert.equal(Object.hasOwn(result,'opinione_0'),true);
        assert.equal(Object.hasOwn(result,'opinione_94'),true);
        assert.equal(Object.hasOwn(result,'opinione_95'),false);
        for(const id of ['opinione_0','opinione_94']){
          assert.equal(Object.values(result[id]).reduce((a,b)=>a+b,0),11);
        }
        assert.equal(result.opinione_0.favorevole>=1,true);
      });
      await t.test('11 consenting users with one contrary answer are fully suppressed',async()=>{
        await db.query(
          'UPDATE ci_hybrid_agg_answers SET "opinione_0"=$2, '+
          "answers_extra=jsonb_set(answers_extra,'{opinione_94}',to_jsonb($2::text)) "+
          'WHERE user_id=$1',[uid(11),'c']
        );
        const mixed=await stats(db,['opinione_0','opinione_94']);
        assert.equal(Object.hasOwn(mixed,'opinione_0'),false);
        assert.equal(Object.hasOwn(mixed,'opinione_94'),false);
        await db.query(
          'UPDATE ci_hybrid_agg_answers SET "opinione_0"=$2, '+
          "answers_extra=jsonb_set(answers_extra,'{opinione_94}',to_jsonb($2::text)) "+
          'WHERE user_id=$1',[uid(11),'f']
        );
      });
      await t.test('region, province and town cells show exactly ten consenting users',async()=>{
        const cases=[
          ['regione',['Toscana']],
          ['provincia',['Toscana','Livorno']],
          ['comune',['Toscana','Livorno','Livorno']]
        ];
        for(const [scope,scopeValues] of cases){
          const result=await stats(db,['opinione_0','opinione_94'],scope,scopeValues);
          assert.equal(Object.values(result.opinione_0).reduce((a,b)=>a+b,0),10);
          assert.equal(Object.values(result.opinione_94).reduce((a,b)=>a+b,0),10);
        }
        const tiny=await stats(db,['opinione_94'],'regione',['Lazio']);
        assert.deepEqual({...tiny},{});
      });
      await t.test('explicit user_consents overrides base consent in both directions',async()=>{
        // Base consent of person 2 is false, but explicit consent is true.
        await db.query('UPDATE ci_hybrid_agg_consents SET political_opinions_consent=false WHERE user_id=$1',[uid(2)]);
        const noOverride=await stats(db,['opinione_0','opinione_94'],'regione',['Toscana']);
        assert.deepEqual({...noOverride},{});
        await db.query('UPDATE ci_hybrid_agg_consents SET political_opinions_consent=true WHERE user_id=$1',[uid(2)]);
        const granted=await stats(db,['opinione_0','opinione_94'],'regione',['Toscana']);
        assert.equal(Object.values(granted.opinione_94).reduce((a,b)=>a+b,0),10);

        // Base consent of person 12 is true, but explicit false overrides it.
        await db.query('UPDATE ci_hybrid_agg_consents SET political_opinions_consent=true WHERE user_id=$1',[uid(12)]);
        const extra=await stats(db,['opinione_0','opinione_94'],'regione',['Toscana']);
        assert.equal(Object.values(extra.opinione_94).reduce((a,b)=>a+b,0),11);
        await db.query('UPDATE ci_hybrid_agg_consents SET political_opinions_consent=false WHERE user_id=$1',[uid(12)]);
        const restored=await stats(db,['opinione_0','opinione_94'],'regione',['Toscana']);
        assert.equal(Object.values(restored.opinione_0).reduce((a,b)=>a+b,0),10);
      });
      await t.test('territorial parameters cannot change the SQL filter',async()=>{
        const result=await stats(db,['opinione_94'],'regione',[
          "Toscana' OR TRUE --"
        ]);
        assert.deepEqual({...result},{});
      });
      await t.test('matching uses both sources of answers for explicitly requested users',async()=>{
        const r=await db.query(
          'SELECT user_id,"opinione_0","opinione_1",answers_extra '+
          'FROM ci_hybrid_agg_answers WHERE user_id=ANY($1::uuid[])',
          [[uid(1),uid(2)]]
        );
        const maps=projectHybridMatchingMaps(r.rows,[uid(1),uid(2)],
          ['opinione_0','opinione_94'],published,legacy);
        assert.equal(maps.size,2);
        assert.ok(['f','c','i'].includes(maps.get(uid(1)).opinione_0));
        assert.ok(['f','c','i'].includes(maps.get(uid(2)).opinione_94));
        assert.equal(Object.hasOwn(maps.get(uid(1)),'opinione_archived'),false);
      });
      await t.test('revocation makes territorial cell 10 -> 9, suppresses both types',async()=>{
        // Same synthetic transaction locks user before deleting answer row.
        await db.query('BEGIN');
        try{
          await db.query('SELECT id FROM ci_hybrid_agg_users WHERE id=$1 FOR UPDATE',[uid(1)]);
          await db.query('UPDATE ci_hybrid_agg_users SET political_opinions_consent=false WHERE id=$1',[uid(1)]);
          await db.query('DELETE FROM ci_hybrid_agg_answers WHERE user_id=$1',[uid(1)]);
          await db.query('COMMIT');
        }catch(e){await db.query('ROLLBACK');throw e;}
        const region=await stats(db,['opinione_0','opinione_94'],'regione',['Toscana']);
        assert.deepEqual({...region},{});
        const national=await stats(db,['opinione_0','opinione_94']);
        assert.equal(Object.values(national.opinione_0).reduce((a,b)=>a+b,0),10);
        assert.equal(Object.values(national.opinione_94).reduce((a,b)=>a+b,0),10);
      });
      await t.test('archived extra IDs never appear without being published in code',async()=>{
        const result=await stats(db,['opinione_0','opinione_94']);
        assert.equal(Object.hasOwn(result,'opinione_archived'),false);
        const r=await db.query(
          'SELECT answers_extra FROM ci_hybrid_agg_answers WHERE user_id=$1',[uid(2)]
        );
        assert.equal(r.rows[0].answers_extra.opinione_archived,'i');
      });
    }finally{
      await drop(db);
      await db.end();
    }
  }
);
