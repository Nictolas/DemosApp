'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {observeReadOnlySessionContinuity}=
  require('../scripts/unifiedStagingSessionContinuity');

const marker='demos-staging-readonly-'+'a'.repeat(24);
function fakeClient({changePid=false,loseSetting=false,badIdentity=false}={}) {
  let pid=1024, appName='demos-readonly-preflight', transactions=0;
  const queries=[];
  return {
    queries,
    get appName() {return appName;},
    async query(sql,params) {
      queries.push({sql,params});
      if(sql==='BEGIN READ ONLY') {
        transactions++;
        if(changePid && transactions===2) pid=2048;
        if(loseSetting && transactions===2) appName='pooler-reset';
        return {rows:[]};
      }
      if(sql==='ROLLBACK') return {rows:[]};
      if(sql.includes("SELECT pg_backend_pid()")) return {
        rows:[{pid:badIdentity?null:pid,app_name:appName}]};
      if(sql.includes("set_config('application_name'")) {
        appName=params[0];
        return {rows:[{applied:appName}]};
      }
      throw new Error('unexpected SQL');
    },
  };
}

test('read-only preflight: backend and session state persist across transactions',async()=>{
  const client=fakeClient();
  const result=await observeReadOnlySessionContinuity(client,{makeMarker:()=>marker});
  assert.equal(result,true);
  assert.equal(client.appName,'demos-readonly-preflight');
  assert.equal(client.queries.filter(q=>q.sql==='BEGIN READ ONLY').length,4);
  assert.equal(client.queries.filter(q=>q.sql==='ROLLBACK').length,4);
  assert.ok(client.queries.every(q=> /^(BEGIN READ ONLY|ROLLBACK|SELECT )/.test(q.sql)));
  assert.ok(client.queries.every(q=> !/INSERT |UPDATE |DELETE |LOCK |pg_advisory|CREATE /i.test(q.sql)));
  assert.equal(client.queries.filter(q=>q.sql.includes('set_config')).length,2);
});

test('reject backend switch across transaction boundaries, restoring session setting',async()=>{
  const client=fakeClient({changePid:true});
  assert.equal(await observeReadOnlySessionContinuity(client,{makeMarker:()=>marker}),false);
  assert.equal(client.appName,'demos-readonly-preflight');
});

test('reject pooled backend that loses its session setting between transactions',async()=>{
  const client=fakeClient({loseSetting:true});
  assert.equal(await observeReadOnlySessionContinuity(client,{makeMarker:()=>marker}),false);
  assert.equal(client.appName,'demos-readonly-preflight');
});

test('reject incomplete or malformed backend identity',async()=>{
  assert.equal(await observeReadOnlySessionContinuity(fakeClient({badIdentity:true}),{
    makeMarker:()=>marker}),false);
});

test('fail before any query on invalid probe args',async()=>{
  const client=fakeClient();
  for(const rounds of [0,1,2,9,1.2]) await assert.rejects(
    observeReadOnlySessionContinuity(client,{rounds,makeMarker:()=>marker}),
    /STAGING_SESSION_CONTINUITY_INVALID_PROBE/);
  assert.equal(client.queries.length,0);
});

test('reject invalid marker without running session-changing SQL',async()=>{
  const client=fakeClient();
  await assert.rejects(observeReadOnlySessionContinuity(client,{
    makeMarker:()=> 'secret-or-url-value'}),/STAGING_SESSION_CONTINUITY_INVALID_MARKER/);
  assert.equal(client.queries.some(q=>q.sql.includes('set_config')),false);
});
