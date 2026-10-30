'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createHybridHttpResearchRouter}=
  require('../experiments/opinionAnswersV2HttpContractCandidate');
const {createHybridAuthorizedReadCandidate}=
  require('../experiments/opinionAnswersV2AuthorizedReadCandidate');

const ownId='00000000-0000-4000-8000-000000000031';
const otherId='00000000-0000-4000-8000-000000000032';
const opinions=[
  {id:'opinione_0',text:'Opinione storica',gradi_opinione:['N']},
  {id:'opinione_94',text:'Nuova Opinione',gradi_opinione:['N']}
];

test('real Express HTTP contract against synthetic in-memory data, no live DB',
  async t=>{
  const state={restoreReady:true,consent:true,row:{
    user_id:ownId,opinione_0:'f',answers_extra:{
      opinione_94:'c',opinione_archived:'i'
    }
  },counts:10,sexSmall:false,wrongSubject:false,readCalls:[],
    statsCalls:[],demographicCalls:[],gates:0};
  const assertRestoreReady=async()=>{
    state.gates++;
    if(!state.restoreReady){
      const e=Error('External restore gate is closed');
      e.code='RESTORE_NOT_READY';throw e;
    }
    return true;
  };
  const loadOwnAuthorizedRow=createHybridAuthorizedReadCandidate({
    assertRestoreReady,
    db:{query:async(_sql,[id])=>{
      state.readCalls.push(id);
      if(!state.consent)return {rows:[{
        subject_id:id,granted:false,answer_row:null
      }]};
      return {rows:[{
        subject_id:id,granted:true,
        answer_row:state.wrongSubject
          ? {...state.row,user_id:otherId} : state.row
      }]};
    }}
  });
  const deps={
    immutableLegacyIds:['opinione_0'],
    authenticate:async req=>
      req.headers.authorization==='Bearer fake-access-token'
        ? {userId:ownId} : null,
    resolveGrade:value=>value==='N'?'N':value==='R'?'R':'',
    getGradeOpinions:grade=>grade==='N'?opinions:[],
    getPublishedOpinion:id=>opinions.find(x=>x.id===id)||null,
    assertRestoreReady,loadOwnAuthorizedRow,
    querySingleAggregate:async opinionId=>{
      state.statsCalls.push(opinionId);
      return [{opinion_id:opinionId,favorevole:state.counts===10?4:3,
        contrario:3,indeciso:3}];
    },
    queryDemographic:async (opinionId,dimension)=>{
      state.demographicCalls.push([opinionId,dimension]);
      if(dimension==='eta')return [
        {fascia_eta:'18-25',favorevole:4,contrario:3,indeciso:3}
      ];
      return [
        {sesso:'F',favorevole:state.sexSmall?3:4,contrario:3,indeciso:3},
        {sesso:'M',favorevole:4,contrario:3,indeciso:3}
      ];
    }
  };
  assert.throws(()=>createHybridHttpResearchRouter({
    ...deps,loadOwnAuthorizedRow:async()=>({status:'ok',row:null})
  }),/shared external GDPR gate/);
  assert.throws(()=>createHybridHttpResearchRouter({
    ...deps,assertRestoreReady:async()=>true
  }),/shared external GDPR gate/);
  const app=express();
  app.disable('x-powered-by');
  app.use('/api/opinioni',createHybridHttpResearchRouter(deps));
  const server=await new Promise((resolve,reject)=>{
    const s=app.listen(0,'127.0.0.1',()=>resolve(s));
    s.once('error',reject);
  });
  const base='http://127.0.0.1:'+server.address().port;
  async function request(path,{authorized=false,extraHeaders={}}={}){
    const response=await fetch(base+'/api/opinioni'+path,{
      headers:{
        ...(authorized?{authorization:'Bearer fake-access-token'}:{}),
        ...extraHeaders
      },
      redirect:'manual'
    });
    return {status:response.status,json:await response.json()};
  }
  try{
    await t.test('unauthenticated GET never reads political answers',async()=>{
      const before=state.readCalls.length;
      const response=await request('/opinioni-list?grado=N',{
        extraHeaders:{'x-user-id':otherId}
      });
      assert.equal(response.status,401);
      assert.equal(state.readCalls.length,before);
      assert.equal(JSON.stringify(response.json).includes('userAnswer'),false);
    });
    await t.test('missing grade returns legacy 400 and no subject read',async()=>{
      const before=state.readCalls.length;
      const out=await request('/opinioni-list',{authorized:true});
      assert.equal(out.status,400);
      assert.equal(out.json.error,'Grado richiesto');
      assert.equal(state.readCalls.length,before);
    });
    await t.test('existing GET grade preserves text IDs, stable answers and one authorized read',async()=>{
      const before=state.readCalls.length;
      const response=await request('/opinioni-list?grado=N',{authorized:true,
        extraHeaders:{'x-user-id':otherId}
      });
      assert.equal(response.status,200);
      assert.deepEqual(response.json,{
        success:true,grado:'N',total:2,data:[
          {id:'opinione_storica',text:'Opinione storica',
            grado:['N'],userAnswer:'f'},
          {id:'nuova_opinione',text:'Nuova Opinione',
            grado:['N'],userAnswer:'c'}
        ]
      });
      assert.deepEqual(state.readCalls.slice(before),[ownId]);
      assert.equal(state.gates,1,'one external restore attestation per personal GET');
      assert.equal(JSON.stringify(response.json).includes('opinione_archived'),false);
    });
    await t.test('empty public grade never reads an answer row',async()=>{
      const before=state.readCalls.length;
      const response=await request('/opinioni-list?grado=R',{authorized:true});
      assert.equal(response.status,200);
      assert.deepEqual(response.json,{
        success:true,data:[],message:'Nessuna opinione trovata per il grado: R'
      });
      assert.equal(state.readCalls.length,before);
    });
    await t.test('revoked consent never reveals old or future answers',async()=>{
      state.consent=false;
      const response=await request('/opinioni-list?grado=N',{authorized:true});
      assert.equal(response.status,403);
      assert.equal(response.json.error,'Consenso richiesto');
      assert.equal(JSON.stringify(response.json).includes('opinione_94'),false);
      state.consent=true;
    });
    await t.test('wrong subject response is rejected, not exposed',async()=>{
      state.wrongSubject=true;
      const response=await request('/opinioni-list?grado=N',{authorized:true});
      assert.equal(response.status,500);
      assert.equal(response.json.error,'Errore interno del server');
      assert.equal(JSON.stringify(response.json).includes(otherId),false);
      state.wrongSubject=false;
    });
    await t.test('public single-opinion stats suppress 9 but publish 10',async()=>{
      const passed=await request('/stats/opinione_94');
      assert.equal(passed.status,200);
      assert.deepEqual(passed.json,{
        success:true,data:{
          suppressed:false,minimumCellSize:10,questionText:'Nuova Opinione',
          stats:{favorevole:4,contrario:3,indeciso:3},
          totaleUtenti:10
        }
      });
      state.counts=9;
      const hidden=await request('/stats/opinione_94');
      assert.equal(hidden.status,200);
      assert.deepEqual(hidden.json,{
        success:true,data:{
          suppressed:true,minimumCellSize:10,questionText:'Nuova Opinione'
        }
      });
      assert.equal(JSON.stringify(hidden.json).includes('totaleUtenti'),false);
      state.counts=10;
    });
    await t.test('archived ID 404 before SQL aggregates, never leaked',async()=>{
      const before=state.statsCalls.length;
      const response=await request('/stats/opinione_archived');
      assert.equal(response.status,404);
      assert.equal(state.statsCalls.length,before);
    });
    await t.test('age and legacy genere contracts from new sesso, with full suppression',async()=>{
      const age=await request('/stats/opinione_94/eta');
      assert.equal(age.status,200);
      assert.deepEqual(age.json,{
        success:true,minimumCellSize:10,
        data:[{fascia_eta:'18-25',favorevole:4,contrario:3,indeciso:3}]
      });
      const sex=await request('/stats/opinione_94/genere');
      assert.equal(sex.status,200);
      assert.deepEqual(sex.json,{
        success:true,minimumCellSize:10,
        data:[
          {genere:'Donna',favorevole:4,contrario:3,indeciso:3},
          {genere:'Uomo',favorevole:4,contrario:3,indeciso:3}
        ]
      });
      state.sexSmall=true;
      const hidden=await request('/stats/opinione_94/genere');
      assert.deepEqual(hidden.json,{success:true,minimumCellSize:10,data:[]});
      state.sexSmall=false;
    });
    await t.test('closed GDPR restore gate returns 503 before personal read OR public count',async()=>{
      state.restoreReady=false;
      const beforeAnswers=state.readCalls.length;
      const beforeStats=state.statsCalls.length;
      const privateResult=await request('/opinioni-list?grado=N',{authorized:true});
      const publicResult=await request('/stats/opinione_94');
      assert.equal(privateResult.status,503);
      assert.equal(publicResult.status,503);
      assert.equal(state.readCalls.length,beforeAnswers);
      assert.equal(state.statsCalls.length,beforeStats);
      assert.equal(JSON.stringify(privateResult.json).includes(ownId),false);
      state.restoreReady=true;
    });
    await t.test('malformed aggregate is a generic 500 with no raw count leakage',async()=>{
      const original=deps.querySingleAggregate;
      deps.querySingleAggregate=async()=>[
        {opinion_id:'opinione_archived',favorevole:99,contrario:0,indeciso:0}
      ];
      const response=await request('/stats/opinione_94');
      assert.equal(response.status,500);
      assert.equal(JSON.stringify(response.json).includes('99'),false);
      deps.querySingleAggregate=original;
    });
    await t.test('mutating dependency object cannot swap trusted reader or restore gate after setup',async()=>{
      const originalReader=deps.loadOwnAuthorizedRow;
      const originalGate=deps.assertRestoreReady;
      const before=state.readCalls.length;
      try{
        deps.loadOwnAuthorizedRow=async()=>({
          status:'ok',
          row:{user_id:ownId,opinione_0:'f',
            answers_extra:{opinione_94:'c'}}
        });
        deps.assertRestoreReady=async()=>true;
        state.restoreReady=false;
        const personal=await request('/opinioni-list?grado=N',{authorized:true});
        const publicStats=await request('/stats/opinione_94');
        assert.equal(personal.status,503);
        assert.equal(publicStats.status,503);
        assert.equal(state.readCalls.length,before);
        assert.equal(JSON.stringify(personal.json).includes('userAnswer'),false);
      }finally{
        state.restoreReady=true;
        deps.loadOwnAuthorizedRow=originalReader;
        deps.assertRestoreReady=originalGate;
      }
    });
  }finally{
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
