'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { getAllOpinions, getOpinionsForGrade } = require('../services/opinionCatalog');

const BASE = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(BASE, 'middleware/auth.js'));
const jwtPath = require.resolve(path.join(BASE, 'utils/jwt.js'));
const compatibilityPath = require.resolve(path.join(BASE, 'routes/compatibility.js'));
const managementPath = require.resolve(path.join(BASE, 'routes/opinioni/management.js'));
const answersPath = require.resolve(path.join(BASE, 'routes/opinioni/user-answers.js'));
const emailFreeFakeUser = 'android-110-fixture';

async function withAndroid110Contract(callback) {
  const originals = new Map([authPath,jwtPath,compatibilityPath,managementPath,answersPath]
    .map(name => [name,require.cache[name]]));
  let server;
  const state = {answer:null,hasRow:false,sql:[]};
  const fixtureId = 'energia_nucleare';
  const query = async (statement,params=[]) => {
    const sql=String(statement).replace(/\s+/g,' ').trim();
    state.sql.push(sql);
    if(/\bopinioni_domande\b/i.test(sql)) throw Error('Legacy catalog table read/write is forbidden: '+sql);
    if(sql.includes('FROM users u LEFT JOIN LATERAL') && sql.includes('FROM opinioni_risposte a WHERE a.user_id = u.id')) {
      assert.deepEqual(params,[emailFreeFakeUser]);
      assert.ok(!sql.includes('fonti_opinioni') && !sql.includes('SELECT *'));
      return {rows:[{id:emailFreeFakeUser,status:'a',ruolo:'E',
        opinion_answers:state.hasRow?{[fixtureId]:state.answer}:null}]};
    }
    if(sql==='SELECT id FROM users WHERE id = $1 FOR UPDATE'){
      assert.deepEqual(params,[emailFreeFakeUser]);
      return {rows:[{id:emailFreeFakeUser}],rowCount:1};
    }
    if(sql.includes('AS granted') && sql.includes('user_consents')) {
      return {rows:[{granted:true}],rowCount:1};
    }
    if(sql.includes('information_schema.columns')) throw Error('No DB schema lookup on save');
    if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[],rowCount:0};
    if(sql.includes('FROM opinioni_risposte') && sql.includes('FOR UPDATE')){
      return {rows:state.hasRow?[{user_id:emailFreeFakeUser,[fixtureId]:state.answer}]:[],rowCount:state.hasRow?1:0};
    }
    if(sql.startsWith('INSERT INTO opinioni_risposte')){
      assert.match(sql,/energia_nucleare/);
      assert.deepEqual(params,[emailFreeFakeUser,'f']);
      state.answer=params[1];state.hasRow=true;return {rows:[],rowCount:1};
    }
    if(sql.startsWith('UPDATE opinioni_risposte')){
      state.answer=params[0];return {rows:[],rowCount:1};
    }
    throw Error('Unexpected SQL in Android 1.0.10 compatibility fixture: '+sql);
  };
  const pool={query,connect:async()=>({query,release(){}})};
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{
    pool,
    verifyToken:(req,res,next)=>{
      if(req.headers.authorization!=='Bearer android-test-token')return res.status(401).json({success:false,error:'Autenticazione richiesta'});
      req.userId=emailFreeFakeUser;req.user={id:emailFreeFakeUser,isPolitician:false,isCandidate:false};
      req.userRole='E';next();
    },
    requireAdmin:(_req,_res,next)=>next()
  }};
  require.cache[jwtPath]={id:jwtPath,filename:jwtPath,loaded:true,exports:{
    verifyAccessToken:token=>{
      if(token!=='android-test-token')throw Error('invalid token');
      return {userId:emailFreeFakeUser};
    }
  }};
  for(const modulePath of [compatibilityPath,managementPath,answersPath])delete require.cache[modulePath];
  try{
    const app=express();app.use(express.json());
    app.use('/api',require(compatibilityPath));
    app.use('/api/opinioni',require(managementPath));
    app.use('/api/opinioni',require(answersPath));
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    await callback({base:'http://127.0.0.1:'+server.address().port,state,fixtureId});
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const [p,previous] of originals){if(previous)require.cache[p]=previous;else delete require.cache[p];}
  }
}

const options={headers:{authorization:'Bearer android-test-token'}};

test('Android 1.0.10 national/territorial Opinions, save and fresh verification keep original API JSON',async()=>{
  await withAndroid110Contract(async({base,state,fixtureId})=>{
    const noToken=await fetch(base+'/api/opinioni-list?grado=N');
    assert.equal(noToken.status,401);
    assert.equal(state.sql.length,0,'No SQL before authentication');

    for(const grade of ['N','R','CO','E']){
      const response=await fetch(base+'/api/opinioni-list?grado='+grade,options);
      assert.equal(response.status,200);
      const body=await response.json();
      assert.equal(body.success,true);
      assert.equal(body.grado,grade);
      assert.equal(body.total,getOpinionsForGrade(grade).length);
      assert.equal(body.data.length,body.total);
      assert.equal(state.sql.length, ['N','R','CO','E'].indexOf(grade)+1,
        'Exactly one joined SQL query per grade, even before an answer row exists');
      for(const row of body.data){
        assert.equal(typeof row.id,'string');
        assert.equal(typeof row.text,'string');
        assert.ok(row.grado.includes(grade));
        assert.ok([null,'f','c','i'].includes(row.userAnswer));
      }
    }
    const before=await fetch(base+'/api/opinioni-list?grado=N',options);
    const listed=(await before.json()).data;
    assert.equal(listed.find(op=>op.id===fixtureId).userAnswer,null);

    const saved=await fetch(base+'/api/opinioni/salva',{
      method:'POST',headers:{...options.headers,'content-type':'application/json'},
      body:JSON.stringify({opinioni:{[fixtureId]:'f'}})
    });
    assert.equal(saved.status,200);
    const result=await saved.json();
    assert.equal(result.success,true);
    assert.equal(result.savedCount,1);
    assert.equal(result.errorCount,0);
    assert.equal(state.sql.some(sql=>sql.includes('information_schema')),false,'Save must use catalog IDs, not DB metadata');
    const beginPosition=state.sql.findIndex(sql=>sql==='BEGIN');
    const lockedConsentPosition=state.sql.findIndex(sql=>sql==='SELECT id FROM users WHERE id = $1 FOR UPDATE');
    const freshConsentPosition=state.sql.findIndex((sql,i)=>i>lockedConsentPosition && sql.includes('AS granted'));
    const insertPosition=state.sql.findIndex(sql=>sql.startsWith('INSERT INTO opinioni_risposte'));
    assert.ok(beginPosition>=0 && lockedConsentPosition>beginPosition, 'Consent must be locked inside the write transaction');
    assert.ok(freshConsentPosition>lockedConsentPosition, 'Fresh consent must be read after lock acquisition');
    assert.ok(insertPosition>freshConsentPosition, 'No opinion writes before fresh consent verification');

    // The published Android 1.0.10 saveAndVerifyOpinions() requires an
    // authenticated fresh GET returning the same ID and compressed value.
    const verified=await fetch(base+'/api/opinioni-list?grado=N',options);
    const actual=(await verified.json()).data;
    assert.equal(actual.find(op=>op.id===fixtureId).userAnswer,'f');

    const all=await fetch(base+'/api/opinioni',options);
    assert.equal(all.status,200);
    assert.equal((await all.json()).data.length,getAllOpinions().length);
    const profile=await fetch(base+'/api/opinioni/profile',options);
    assert.equal(profile.status,200);
    assert.equal((await profile.json()).data.questions.length,getAllOpinions().length);
    const detail=await fetch(base+'/api/opinioni/'+fixtureId+'/approfondimento',options);
    assert.equal(detail.status,200);
    assert.equal((await detail.json()).data.id,fixtureId);

    for(const [method,url] of [['POST','/api/opinioni'],['PUT','/api/opinioni/'+fixtureId],['DELETE','/api/opinioni/'+fixtureId],['PUT','/api/opinioni/'+fixtureId+'/approfondimento']]){
      const response=await fetch(base+url,{method,headers:{...options.headers,'content-type':'application/json'},body:method==='DELETE'?undefined:'{}'});
      assert.equal(response.status,409,method+' '+url);
      assert.equal((await response.json()).error,'CATALOG_RELEASE_REQUIRED');
    }
    assert.equal(state.sql.some(sql=>/\bopinioni_domande\b/i.test(sql)),false);
  });
});
