'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  LOCK_SUBJECT_SQL,CHECK_CONSENT_SQL
}=require('../experiments/opinionAnswersV2AuthorizedWriteCandidate');
const {
  buildHybridChangedAnswerSelect,
  executeAuthorizedHybridPersonalSave
}=require('../experiments/opinionAnswersV2PersonalWriteCandidate');

const subject='00000000-0000-4000-8000-000000000071';
const historical=['opinione_0','opinione_1'];
const published=new Set([...historical,'opinione_94']);
function fake(options={}){
  const queries=[];
  let notifications=0;
  const client={query:async(sql,params)=>{
    queries.push({sql,params});
    if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {};
    if(sql===LOCK_SUBJECT_SQL){
      return {rows:options.missing?[]:[{id:subject}]};
    }
    if(sql===CHECK_CONSENT_SQL){
      return {rows:[{granted:options.consent!==false}]};
    }
    if(sql.startsWith('SELECT ')&&sql.includes('FROM opinioni_risposte')){
      return {rows:options.oldRow?[options.oldRow]:[]};
    }
    if(sql.startsWith('INSERT INTO opinioni_risposte')){
      if(options.sqlError)throw Error('synthetic save error');
      return {rowCount:options.rowCount??1};
    }
    throw Error('Unexpected SQL '+sql);
  }};
  const args={
    client,userId:subject,
    answerPatch:{opinione_0:'f',opinione_94:'c'},
    publishedIds:published,historicalIds:historical,
    assertRestoreReady:async()=>{
      queries.push({sql:'restore-gate'});
      if(options.restore===false)return false;
      return true;
    },
    recordChangeNotifications:async(_db,id,changes)=>{
      notifications++;
      assert.equal(id,subject);
      if(options.failNotice)throw Error('synthetic notification failure');
      return {created:changes.length};
    }
  };
  return {args,queries,notifications:()=>notifications};
}

test('preimage selects changed TEXT columns and one JSONB, never catalog SQL',()=>{
  const statement=buildHybridChangedAnswerSelect({
    opinione_0:'f',opinione_94:'c'
  },historical);
  assert.equal(statement,
    'SELECT "opinione_0",answers_extra FROM opinioni_risposte WHERE user_id=$1::uuid FOR UPDATE');
  assert.equal(buildHybridChangedAnswerSelect({
    opinione_94:'f'
  },historical),
    'SELECT answers_extra FROM opinioni_risposte WHERE user_id=$1::uuid FOR UPDATE');
  assert.doesNotMatch(statement,/opinioni_domande|information_schema/);
});

test('first answers make one upsert, no notifications and one preimage SELECT',async()=>{
  const h=fake();
  const result=await executeAuthorizedHybridPersonalSave(h.args);
  assert.deepEqual(result,{
    savedCount:2,changedCount:2,
    firstAnswers:['opinione_0','opinione_94'],
    changedOpinionsForPush:[],notificationsCreated:0
  });
  assert.deepEqual(h.queries.map(x=>x.sql).slice(0,4),[
    'restore-gate','BEGIN',LOCK_SUBJECT_SQL,CHECK_CONSENT_SQL
  ]);
  assert.equal(h.queries.filter(x=>x.sql.startsWith('SELECT ')&&
    x.sql.includes('FROM opinioni_risposte')).length,1);
  assert.equal(h.queries.filter(x=>x.sql.startsWith('INSERT INTO opinioni_risposte')).length,1);
  assert.equal(h.queries.at(-1).sql,'COMMIT');
  assert.equal(h.notifications(),0);
});

test('unchanged answers skip upsert and event writes',async()=>{
  const h=fake({oldRow:{
    opinione_0:'f',answers_extra:{opinione_94:'c'}
  }});
  const result=await executeAuthorizedHybridPersonalSave(h.args);
  assert.equal(result.changedCount,0);
  assert.equal(result.savedCount,2);
  assert.equal(result.notificationsCreated,0);
  assert.equal(h.queries.some(q=>q.sql.startsWith('INSERT INTO opinioni_risposte')),false);
  assert.equal(h.notifications(),0);
  assert.equal(h.queries.at(-1).sql,'COMMIT');
});

test('one changed historical and one changed future answer notify exactly once each',async()=>{
  const h=fake({oldRow:{
    opinione_0:'c',answers_extra:{opinione_94:'i'}
  }});
  const result=await executeAuthorizedHybridPersonalSave(h.args);
  assert.equal(result.changedCount,2);
  assert.deepEqual(result.firstAnswers,[]);
  assert.deepEqual(result.changedOpinionsForPush,[
    {opinionId:'opinione_0',previousValue:'c',newValue:'f'},
    {opinionId:'opinione_94',previousValue:'i',newValue:'c'}
  ]);
  assert.equal(result.notificationsCreated,2);
  assert.equal(h.notifications(),1);
  assert.equal(h.queries.at(-1).sql,'COMMIT');
});

test('restore gate, revoked consent and missing user fail closed',async()=>{
  const closed=fake({restore:false});
  await assert.rejects(executeAuthorizedHybridPersonalSave(closed.args),
    e=>e.code==='RESTORE_NOT_READY');
  assert.deepEqual(closed.queries.map(x=>x.sql),['restore-gate']);
  for(const opts of [{consent:false},{missing:true}]){
    const h=fake(opts);
    await assert.rejects(executeAuthorizedHybridPersonalSave(h.args),
      e=>e.code===(opts.missing?'SUBJECT_NOT_FOUND':'POLITICAL_CONSENT_REQUIRED'));
    assert.equal(h.queries.at(-1).sql,'ROLLBACK');
    assert.equal(h.queries.some(x=>x.sql.startsWith('INSERT')),false);
  }
});

test('notification failure, write failure or wrong row count undo mutation',async()=>{
  for(const opts of [
    {oldRow:{opinione_0:'c',answers_extra:{opinione_94:'i'}},failNotice:true},
    {sqlError:true},
    {rowCount:0}
  ]){
    const h=fake(opts);
    await assert.rejects(executeAuthorizedHybridPersonalSave(h.args));
    assert.equal(h.queries.at(-1).sql,'ROLLBACK');
    assert.equal(h.queries.some(x=>x.sql==='COMMIT'),false);
  }
});

test('malformed delta and untrusted IDs never touch DB or restore gate',async()=>{
  for(const patch of [{opinione_0:null},{not_published:'f'},{},['f']]){
    const h=fake();h.args.answerPatch=patch;
    await assert.rejects(executeAuthorizedHybridPersonalSave(h.args));
    assert.deepEqual(h.queries,[]);
  }
});
