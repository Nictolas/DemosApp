'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {Client}=require('pg');
const {createHybridHttpResearchRouter}=
  require('../experiments/opinionAnswersV2HttpContractCandidate');
const {createHybridPersonalSaveHttpResearchRouter}=
  require('../experiments/opinionAnswersV2PersonalSaveHttpCandidate');
const {createHybridAuthorizedReadCandidate}=
  require('../experiments/opinionAnswersV2AuthorizedReadCandidate');
const {formatHybridProfileOpinions}=
  require('../experiments/opinionAnswersV2HybridCandidate');

const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const subject=id(71);
const SCHEMA='ci_hybrid_http_roundtrip';
const historical=['opinione_0'];
const published=[
  {id:'opinione_0',text:'Opinione storica',gradi_opinione:['N']},
  {id:'opinione_94',text:'Nuova Opinione',gradi_opinione:['N']}
];
function guard(){
  const u=new URL(uri);
  if(process.env.GITHUB_ACTIONS!=='true'||
    !['localhost','127.0.0.1','::1'].includes(u.hostname)||
    u.pathname!=='/opinion_answers_ci'){
    throw Error('Only isolated PostgreSQL 17 CI is allowed');
  }
}
test('PG17 + localhost HTTP: old/new answers save, list, revoke, regrant, privacy',
  {skip:!enabled},async t=>{
  guard();
  const a=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  const b=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await a.connect();await b.connect();
  let server=null;
  try{
    await a.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE');
    await a.query('CREATE SCHEMA '+SCHEMA);
    for(const client of [a,b]){
      await client.query('SET search_path TO '+SCHEMA+',public');
    }
    await a.query('CREATE TABLE users('+
      'id uuid PRIMARY KEY,political_opinions_consent boolean NOT NULL)');
    await a.query('CREATE TABLE user_consents('+
      'user_id uuid PRIMARY KEY REFERENCES users(id),'+
      'political_opinions_consent boolean)');
    await a.query('CREATE TABLE opinioni_risposte('+
      'user_id uuid PRIMARY KEY REFERENCES users(id),'+
      '"opinione_0" text, '+
      "answers_extra jsonb NOT NULL DEFAULT '{}'::jsonb,"+
      "fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb)");
    await a.query('CREATE TABLE notifications('+
      'user_id uuid NOT NULL,opinion_id text NOT NULL,'+
      'previous_value text NOT NULL,new_value text NOT NULL)');
    await a.query('INSERT INTO users VALUES($1,true)',[subject]);
    await a.query('INSERT INTO user_consents VALUES($1,true)',[subject]);

    const state={
      gateReady:true,gateChecks:0,sql:[],notices:[],failNotices:false,
      acquisitions:0,releases:0
    };
    const externalGate=async()=>{
      state.gateChecks++;
      if(!state.gateReady){
        const e=Error('external restore not verified');e.code='RESTORE_NOT_READY';
        throw e;
      }
      return true;
    };
    const traced={
      query:(sql,params)=>{
        state.sql.push(sql);
        return a.query(sql,params);
      }
    };
    const readOwn=createHybridAuthorizedReadCandidate({
      db:traced,assertRestoreReady:externalGate
    });
    const auth=req=>req.headers.authorization==='Bearer synthetic-user'
      ? {userId:subject}:null;
    const app=express();
    app.use(express.json({limit:'20kb'}));
    app.use('/api/opinioni',createHybridHttpResearchRouter({
      immutableLegacyIds:historical,
      authenticate:auth,assertRestoreReady:externalGate,
      resolveGrade:grade=>grade==='N'?'N':'',
      getGradeOpinions:grade=>grade==='N'?published:[],
      getPublishedOpinion:opinionId=>
        published.find(op=>op.id===opinionId)||null,
      loadOwnAuthorizedRow:readOwn,
      querySingleAggregate:async()=>{throw Error('Unexpected statistics call');},
      queryDemographic:async()=>{throw Error('Unexpected demographics call');}
    }));
    app.use('/api/opinioni',createHybridPersonalSaveHttpResearchRouter({
      authenticate:auth,
      immutableLegacyIds:historical,
      getPublishedIds:()=>new Set(published.map(op=>op.id)),
      assertRestoreReady:externalGate,
      acquireClient:async()=>{
        state.acquisitions++;
        return {
          client:traced,
          release:()=>{state.releases++;}
        };
      },
      recordChangeNotifications:async(client,userId,changes)=>{
        for(const change of changes){
          await client.query('INSERT INTO notifications VALUES($1,$2,$3,$4)',[
            userId,change.opinionId,change.previousValue,change.newValue
          ]);
        }
        if(state.failNotices)throw Error('synthetic notification failure');
        state.notices.push(...changes);
        return {created:changes.length};
      }
    }));
    server=await new Promise((resolve,reject)=>{
      const s=app.listen(0,'127.0.0.1',()=>resolve(s));
      s.once('error',reject);
    });
    const base='http://127.0.0.1:'+server.address().port+'/api/opinioni';
    async function request(method,path,body,authorized=true){
      const response=await fetch(base+path,{
        method,
        headers:{
          ...(authorized?{authorization:'Bearer synthetic-user'}:{}),
          ...(body===undefined?{}:{'content-type':'application/json'})
        },
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
      return {status:response.status,data:await response.json()};
    }
    const get=()=>request('GET','/opinioni-list?grado=N');
    const save=body=>request('POST','/salva',body);

    await t.test('unauthenticated GET and POST must not touch political SQL',async()=>{
      const count=state.sql.length;
      assert.equal((await request('GET','/opinioni-list?grado=N',undefined,false)).status,401);
      assert.equal((await request('POST','/salva',{opinioni:{opinione_0:'f'}},false)).status,401);
      assert.equal(state.sql.length,count);
    });
    await t.test('initial GET returns null for both opinions with ONE consent-gated SELECT',async()=>{
      const before=state.sql.length;
      const previousGateChecks=state.gateChecks;
      const response=await get();
      assert.equal(response.status,200);
      assert.deepEqual(response.data,{
        success:true,grado:'N',total:2,
        data:[
          {id:'opinione_storica',text:'Opinione storica',
            grado:['N'],userAnswer:null},
          {id:'nuova_opinione',text:'Nuova Opinione',
            grado:['N'],userAnswer:null}
        ]
      });
      assert.equal(state.sql.length-before,1);
      assert.equal(state.gateChecks-previousGateChecks,1,
        'personal GET must verify external restore exactly once');
      assert.match(state.sql.at(-1),/AND COALESCE\(uc.political_opinions_consent,/);
    });
    await t.test('POST mixed historical+future IDs saves once; next GET sees both',async()=>{
      const response=await save({opinioni:{opinione_0:'f',opinione_94:'c'}});
      assert.equal(response.status,200);
      assert.equal(response.data.savedCount,2);
      assert.equal(response.data.errorCount,0);
      assert.equal(response.data.notificationsCreated,0);
      const list=await get();
      assert.equal(list.status,200);
      assert.deepEqual(list.data.data.map(x=>x.userAnswer),['f','c']);
      assert.equal((await a.query('SELECT COUNT(*)::int n FROM notifications')).rows[0].n,0);
    });
    await t.test('same POST again is a no-op without extra answer UPDATE/WAL',async()=>{
      const before=state.sql.length;
      const response=await save({opinione_0:'f',opinione_94:'c'});
      assert.equal(response.status,200);
      assert.equal(response.data.savedCount,2);
      assert.equal(response.data.notificationsCreated,0);
      const executed=state.sql.slice(before);
      assert.equal(executed.some(sql=>sql.startsWith('INSERT INTO opinioni_risposte')),false);
      assert.equal(executed.some(sql=>sql.startsWith('UPDATE opinioni_risposte')),false);
    });
    await t.test('changed answer generates exactly one notification in same commit',async()=>{
      const response=await save({opinioni:{opinione_94:'i'}});
      assert.equal(response.status,200);
      assert.equal(response.data.notificationsCreated,1);
      assert.deepEqual((await a.query(
        'SELECT opinion_id,previous_value,new_value FROM notifications'
      )).rows,[{
        opinion_id:'opinione_94',previous_value:'c',new_value:'i'
      }]);
      assert.deepEqual((await get()).data.data.map(x=>x.userAnswer),['f','i']);
    });
    await t.test('notification failure rolls back answer change too',async()=>{
      state.failNotices=true;
      const response=await save({opinione_0:'c'});
      assert.equal(response.status,500);
      assert.deepEqual((await get()).data.data.map(x=>x.userAnswer),['f','i']);
      assert.equal((await a.query(
        'SELECT COUNT(*)::int n FROM notifications'
      )).rows[0].n,1);
      state.failNotices=false;
    });
    await t.test('unpublished or invalid answer rejects before DB connection',async()=>{
      const before=state.acquisitions;
      const result=await save({opinione_95_unknown:'f'});
      assert.equal(result.status,400);
      assert.equal(state.acquisitions,before);
      const nullAnswer=await save({opinione_0:null});
      assert.equal(nullAnswer.status,400);
      assert.equal(state.acquisitions,before);
    });
    await t.test('external restore outage blocks GET and POST before SQL',async()=>{
      state.gateReady=false;
      const before=state.sql.length;
      assert.equal((await get()).status,503);
      assert.equal((await save({opinione_0:'c'})).status,503);
      assert.equal(state.sql.length,before);
      state.gateReady=true;
    });
    await t.test('revocation deletes old/future answers, GET 403 and POST 403',async()=>{
      await b.query('BEGIN');
      try{
        await b.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[subject]);
        await b.query('UPDATE users SET political_opinions_consent=false WHERE id=$1',[subject]);
        await b.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1',[subject]);
        await b.query('DELETE FROM opinioni_risposte WHERE user_id=$1',[subject]);
        await b.query('COMMIT');
      }catch(e){await b.query('ROLLBACK');throw e;}
      const getResult=await get();
      const postResult=await save({opinione_0:'c',opinione_94:'f'});
      assert.equal(getResult.status,403);
      assert.equal(postResult.status,403);
      assert.equal(JSON.stringify(getResult.data).includes('userAnswer'),false);
      assert.equal((await a.query(
        'SELECT COUNT(*)::int n FROM opinioni_risposte'
      )).rows[0].n,0);
    });
    await t.test('regrant permits only a new answer, not old data restoration',async()=>{
      await b.query('UPDATE users SET political_opinions_consent=true WHERE id=$1',[subject]);
      await b.query('UPDATE user_consents SET political_opinions_consent=true WHERE user_id=$1',[subject]);
      assert.deepEqual((await get()).data.data.map(x=>x.userAnswer),[null,null]);
      const response=await save({opinione_94:'f'});
      assert.equal(response.status,200);
      assert.equal(response.data.notificationsCreated,0);
      const values=(await get()).data.data.map(x=>x.userAnswer);
      assert.deepEqual(values,[null,'f']);
      // Archived future answers must never appear on the public list.
      await a.query(
        "UPDATE opinioni_risposte SET answers_extra=answers_extra || $2::jsonb WHERE user_id=$1",
        [subject,JSON.stringify({opinione_archived:'i'})]
      );
      assert.equal(JSON.stringify((await get()).data).includes('opinione_archived'),false);
      const profile=formatHybridProfileOpinions(
        (await a.query('SELECT * FROM opinioni_risposte WHERE user_id=$1',[subject]))
          .rows[0],published,historical
      );
      assert.deepEqual(profile.map(x=>x.userAnswer),[null,'f']);
    });
    assert.equal(state.acquisitions,state.releases);
  }finally{
    if(server)await new Promise((resolve,reject)=>
      server.close(e=>e?reject(e):resolve())
    );
    await a.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE').catch(()=>{});
    await a.end();await b.end();
  }
});
