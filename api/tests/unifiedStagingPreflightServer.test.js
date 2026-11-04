'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {validatePreflightEnvironment,createPreflightServer,startPreflightServer}=
  require('../staging/unified_staging_preflight_server');

const REF='fkeayjzvtuvzesljhjbc';
const credential='postgresql://demos_staging_preflight.'+REF+
  ':synthetic-no-connection@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
const safe=Object.freeze({
  NODE_ENV:'staging',
  DEMOS_UNIFIED_STAGING_MODE:'preflight',
  DEMOS_UNIFIED_STAGING_PREFLIGHT_GO:'APPROVED_READ_ONLY_PREFLIGHT',
  STAGING_PREFLIGHT_DATABASE_URL:credential,
  STAGING_PREFLIGHT_EXPECTED_POOLER_HOST:'aws-1-eu-central-1.pooler.supabase.com',
  CIVIC_PUSH_ENABLED:'false',
  CIVIC_NEW_INITIATIVE_EVENTS_ENABLED:'false',
  CIVIC_NEW_INITIATIVE_PUSH_ENABLED:'false',
  ENABLE_MINISTERO_SYNC:'false',
  ENABLE_CIVIC_PROCESS_SYNC:'false',
  DEMOS_STAGING_ANDROID_PUSH_E2E:'false',
  ALLOW_DEMOS_STAGING_MIGRATIONS:'false',
  PORT:'10000',
});

test('read-only staging mode and exact session endpoint are mandatory',()=>{
  assert.deepEqual(validatePreflightEnvironment(safe),{port:10000});
  const unsafe=[
    {...safe,NODE_ENV:'production'},
    {...safe,DEMOS_UNIFIED_STAGING_MODE:'application'},
    {...safe,DEMOS_UNIFIED_STAGING_PREFLIGHT_GO:''},
    {...safe,STAGING_PREFLIGHT_DATABASE_URL:credential.replace(':5432/',':6543/')},
    {...safe,STAGING_PREFLIGHT_DATABASE_URL:credential.replace(REF,'aaaaaaaaaaaaaaaaaaaa')},
    {...safe,STAGING_PREFLIGHT_DATABASE_URL:credential.replace(
      'aws-1-eu-central-1.pooler.supabase.com','db.'+REF+'.supabase.co')},
    {...safe,STAGING_PREFLIGHT_EXPECTED_POOLER_HOST:'aws-8-eu-central-1.pooler.supabase.com'},
    {...safe,STAGING_PREFLIGHT_EXPECTED_POOLER_HOST:'aws-0-us-east-1.pooler.supabase.com'},
    {...safe,STAGING_PREFLIGHT_EXPECTED_POOLER_HOST:''},
    {...safe,STAGING_PREFLIGHT_DATABASE_URL:''},
    {...safe,PORT:'0'},
    {...safe,PORT:'65536'},
    {...safe,PORT:'0x1234'},
    null,
  ];
  for(const env of unsafe) assert.throws(()=>validatePreflightEnvironment(env));
});

test('app, delivery, cron and migration flags must be explicitly OFF',()=>{
  for(const key of [
    'CIVIC_PUSH_ENABLED','CIVIC_NEW_INITIATIVE_EVENTS_ENABLED',
    'CIVIC_NEW_INITIATIVE_PUSH_ENABLED','ENABLE_MINISTERO_SYNC',
    'ENABLE_CIVIC_PROCESS_SYNC','DEMOS_STAGING_ANDROID_PUSH_E2E',
    'ALLOW_DEMOS_STAGING_MIGRATIONS',
  ]) {
    for(const val of [undefined,'true','1','yes','']) {
      assert.throws(()=>validatePreflightEnvironment({...safe,[key]:val}),key);
    }
  }
});

test('provider and legacy runtime credentials cannot be loaded into preflight',()=>{
  for(const key of [
    'DATABASE_URL','DIRECT_URL','SUPABASE_SERVICE_ROLE_KEY',
    'PGHOST','PGUSER','PGPASSWORD','FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_SERVICE_ACCOUNT_JSON','GOOGLE_APPLICATION_CREDENTIALS',
    'REDIS_URL',
  ]) assert.throws(()=>validatePreflightEnvironment({...safe,[key]:'synthetic'}),key);
});

async function serve(t,server){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  return (path,method='GET')=>new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port,path,method},res=>{
      let body='';
      res.on('data',c=>body+=c);
      res.on('end',()=>resolve({code:res.statusCode,
        body:JSON.parse(body),headers:res.headers}));
    });
    req.on('error',reject);
    req.end();
  });
}

test('preflight server exposes audit only; application readiness always 503',async t=>{
  const get=await serve(t,createPreflightServer());
  const health=await get('/health');
  assert.equal(health.code,200);
  assert.equal(health.body.app_ready,false);
  assert.equal(health.body.notifications_enabled,false);
  assert.equal(health.headers['cache-control'],'no-store');
  const proof=await get('/health/preflight');
  assert.equal(proof.code,200);
  assert.equal(proof.body.session_affinity_verified,false);
  assert.equal(proof.body.app_ready,false);
  for(const route of ['/health/ready','/health/ready?force=true']) {
    const resp=await get(route);
    assert.equal(resp.code,503);
    assert.equal(resp.body.status,'not_ready');
  }
  for(const route of ['/api/notifiche','/api/notifiche/preferenze',
    '/admin','/internal/push','/push','/oauth/callback']) {
    assert.equal((await get(route)).code,404);
  }
  assert.equal((await get('/health','POST')).code,405);
});

test('no HTTP listener or DB audit after invalid environment',async()=>{
  let calls=0;
  await assert.rejects(startPreflightServer({...safe,CIVIC_PUSH_ENABLED:'true'},{
    runPreflight:async()=>{calls++;return {ready:true,deliveryBlocked:true};}
  }),/STAGING_PREFLIGHT_FLAGS_MUST_BE_OFF/);
  assert.equal(calls,0);
});

test('no HTTP listener after failed or incomplete read-only DB audit',async()=>{
  for(const value of [undefined,{ready:false,deliveryBlocked:true},
      {ready:true,deliveryBlocked:false},{ready:true}]) {
    let calls=0;
    await assert.rejects(startPreflightServer(safe,{
      runPreflight:async()=>{calls++;return value;}
    }),/STAGING_PREFLIGHT_AUDIT_NOT_READY/);
    assert.equal(calls,1);
  }
  await assert.rejects(startPreflightServer(safe,{
    runPreflight:async()=>{throw new Error('RAW_SECRET_SHOULD_NOT_BE_LOGGED');}
  }),/RAW_SECRET_SHOULD_NOT_BE_LOGGED/);
  // CLI entrypoint sanitizes thrown errors; programmatic callers must too.
});

test('no Firebase, app module or sensitive log in isolated staging entrypoint',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const src=fs.readFileSync(path.join(__dirname,'..','staging',
    'unified_staging_preflight_server.js'),'utf8');
  assert.doesNotMatch(src,/require\(['"]\.\.\/app['"]\)/);
  assert.doesNotMatch(src,/require\(['"]firebase-admin['"]\)/);
  assert.doesNotMatch(src,/pushTopics|subscribeToTopic|sendToTopic/);
  assert.match(src,/process\.exitCode=1/);
  assert.match(src,/session_affinity_verified:false/);
});


test('single secret password is safely percent-encoded and does not reach logs', async () => {
  const {resolvePreflightConnectionString}=require('../staging/unified_staging_preflight_server');
  const raw='x'.repeat(35)+':@/?#%\\+-0rN';
  const clean={...safe,STAGING_PREFLIGHT_DATABASE_URL:undefined,
    STAGING_PREFLIGHT_DATABASE_PASSWORD:raw};
  const url=resolvePreflightConnectionString(clean);
  assert.equal(new URL(url).password,encodeURIComponent(raw));
  assert.equal(decodeURIComponent(new URL(url).password),raw);
  assert.equal(new URL(url).hostname,'aws-1-eu-central-1.pooler.supabase.com');
  assert.deepEqual(validatePreflightEnvironment(clean),{port:10000});
  let inspected=false;
  await assert.rejects(startPreflightServer(clean,{
    runPreflight:async actual=>{
      inspected=true;
      assert.equal(actual.STAGING_PREFLIGHT_DATABASE_PASSWORD,undefined);
      assert.equal(actual.STAGING_PREFLIGHT_DATABASE_URL,url);
      return {ready:false,deliveryBlocked:true};
    }
  }),/STAGING_PREFLIGHT_AUDIT_NOT_READY/);
  assert.equal(inspected,true);
  for(const fail of [
    {...clean,STAGING_PREFLIGHT_DATABASE_PASSWORD:'short'},
    {...clean,STAGING_PREFLIGHT_DATABASE_PASSWORD:'x'.repeat(513)},
    {...clean,STAGING_PREFLIGHT_DATABASE_PASSWORD:'x'.repeat(32)+'\n'},
    {...clean,STAGING_PREFLIGHT_DATABASE_URL:credential},
    {...safe,STAGING_PREFLIGHT_DATABASE_URL:undefined},
  ]) assert.throws(()=>validatePreflightEnvironment(fail),
    /STAGING_PREFLIGHT_(PASSWORD_INVALID|CREDENTIAL_AMBIGUOUS|CREDENTIAL_REQUIRED)/);
});
