'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  LOCK_SUBJECT_SQL,CHECK_CONSENT_SQL,
  executeAuthorizedHybridAdminMutation
}=require('../experiments/opinionAnswersV2AuthorizedWriteCandidate');

const principalId='00000000-0000-4000-8000-000000000090';
const userId='00000000-0000-4000-8000-000000000091';
const historicalIds=['opinione_0'];
const publishedIds=new Set(['opinione_0','opinione_94']);
function harness(options={}){
  const calls=[];
  const client={query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {};
    if(sql===LOCK_SUBJECT_SQL)return {rows:options.notFound?[]:[{id:userId}]};
    if(sql===CHECK_CONSENT_SQL)return {
      rows:options.granted===false?[{granted:false}]:[{granted:true}]
    };
    if(/^(INSERT|UPDATE) (INTO )?opinioni_risposte/.test(sql)){
      if(options.failWrite)throw Error('synthetic write error');
      return {rowCount:options.rowCount??1};
    }
    throw Error('Unexpected SQL in mock: '+sql);
  }};
  const args={
    client,principalId,userId,publishedIds,historicalIds,
    assertRestoreReady:async()=>{
      calls.push({sql:'external-restore-gate'});
      if(options.restoreThrows)throw Error('restore not attested');
      return options.restoreReady===false?false:true;
    },
    assertActorAuthorized:async(_client,p,subject)=>{
      calls.push({sql:'admin-auth',params:[p,subject]});
      return options.adminAuthorized===false?false:true;
    },
    answerPatch:{opinione_0:'f',opinione_94:'c'},
    sourcePatch:{opinione_94:'test source'}
  };
  return {calls,args,client};
}
test('one transaction orders restore gate, actor check, users lock, fresh consent, single UPSERT',async()=>{
  const h=harness();
  const result=await executeAuthorizedHybridAdminMutation(h.args);
  assert.deepEqual(result,{saved:true,answerCount:2,sourceCount:1});
  const names=h.calls.map(x=>x.sql);
  assert.equal(names[0],'external-restore-gate');
  assert.deepEqual(names.slice(1,5),[
    'BEGIN','admin-auth',LOCK_SUBJECT_SQL,CHECK_CONSENT_SQL
  ]);
  assert.match(names[5],/^INSERT INTO opinioni_risposte AS current/);
  assert.equal(names[6],'COMMIT');
  assert.equal(names.length,7);
  assert.doesNotMatch(names.join('\n'),/information_schema|opinioni_domande/);
  assert.equal(h.calls[3].params[0],userId);
  assert.equal(h.calls[4].params[0],userId);
});

test('external restore gate closes without any DB query or admin authorization',async()=>{
  for(const options of [{restoreReady:false},{restoreThrows:true}]){
    const h=harness(options);
    await assert.rejects(executeAuthorizedHybridAdminMutation(h.args));
    assert.equal(h.calls.some(x=>x.sql==='BEGIN'),false);
    assert.equal(h.calls.some(x=>x.sql==='admin-auth'),false);
  }
});

test('unprivileged actor rejected BEFORE any subject lock or political read',async()=>{
  const h=harness({adminAuthorized:false});
  await assert.rejects(executeAuthorizedHybridAdminMutation(h.args),
    e=>e.code==='ADMIN_NOT_AUTHORIZED');
  const names=h.calls.map(x=>x.sql);
  assert.deepEqual(names,['external-restore-gate','BEGIN','admin-auth','ROLLBACK']);
});

test('revoked or missing user NEVER reaches SQL write, and rolls back',async()=>{
  for(const options of [{granted:false},{notFound:true}]){
    const h=harness(options);
    await assert.rejects(executeAuthorizedHybridAdminMutation(h.args),
      e=>e.code===(options.notFound?'SUBJECT_NOT_FOUND':'POLITICAL_CONSENT_REQUIRED'));
    const names=h.calls.map(x=>x.sql);
    assert.equal(names.at(-1),'ROLLBACK');
    assert.equal(names.some(x=>/INSERT INTO opinioni_risposte|UPDATE opinioni_risposte/.test(x)),false);
  }
});

test('successful no-op still checks authorization and consent but does no SQL write',async()=>{
  const h=harness();
  h.args.answerPatch={};h.args.sourcePatch={};
  assert.deepEqual(await executeAuthorizedHybridAdminMutation(h.args),{
    saved:false,answerCount:0,sourceCount:0
  });
  const names=h.calls.map(x=>x.sql);
  assert.deepEqual(names.slice(-3),[LOCK_SUBJECT_SQL,CHECK_CONSENT_SQL,'COMMIT']);
});

test('removal of absent source returns no-op without inserting empty opinion row',async()=>{
  const h=harness({rowCount:0});
  h.args.answerPatch={};h.args.sourcePatch={opinione_94:null};
  assert.deepEqual(await executeAuthorizedHybridAdminMutation(h.args),{
    saved:false,answerCount:0,sourceCount:1
  });
  assert.match(h.calls.find(x=>/^UPDATE opinioni_risposte/.test(x.sql)).sql,
    /^UPDATE opinioni_risposte/);
});

test('failed mutation and unverifiable row count roll back whole transaction',async()=>{
  for(const options of [{failWrite:true},{rowCount:2}]){
    const h=harness(options);
    await assert.rejects(executeAuthorizedHybridAdminMutation(h.args));
    const names=h.calls.map(x=>x.sql);
    assert.equal(names.at(-1),'ROLLBACK');
    assert.equal(names.includes('COMMIT'),false);
  }
});

test('malformed payload rejected before any external gate or SQL',async()=>{
  const h=harness();
  h.args.sourcePatch={'unsafe;DROP TABLE users':'bad'};
  await assert.rejects(executeAuthorizedHybridAdminMutation(h.args));
  assert.deepEqual(h.calls,[]);
  const missing=harness();
  delete missing.args.assertActorAuthorized;
  await assert.rejects(executeAuthorizedHybridAdminMutation(missing.args),
    /authorization\/restore gates/);
  assert.deepEqual(missing.calls,[]);
});
