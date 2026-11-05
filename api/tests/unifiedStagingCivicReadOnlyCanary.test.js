'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  SOURCE_QUERIES,checkedPort,probeCivicSourceSchema,
  createCivicReadOnlyServer,startCivicReadOnlyCanary,
}=require('../staging/unified_staging_civic_readonly_canary');

const PROJECT='fkeayjzvtuvzesljhjbc';
const fakeSecret='STAGING_TEST_ONLY_0123456789abcdefghij';
const safe=Object.freeze({
  NODE_ENV:'staging',
  DEMOS_UNIFIED_STAGING_MODE:'app_canary',
  DEMOS_STAGING_APP_CANARY_GO:'I_APPROVE_STAGING_APP_CANARY',
  CIVIC_UNIFIED_STAGING_READY:'true',
  CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED:'true',
  CIVIC_STAGING_PROJECT_REF:PROJECT,
  CIVIC_STAGING_EXPECTED_POOLER_HOST:'aws-1-eu-central-1.pooler.supabase.com',
  CIVIC_STAGING_SESSION_DATABASE_URL:fakeSecret,
  ALLOW_DEV_API_SURFACE:'false',
  PERFORMANCE_MONITOR_ENABLED:'false',
});

const makePool=({failAt=-1,readOnly='on'}={})=>{
  const calls=[],released=[];
  let count=0;
  const client={
    async query(sql){
      calls.push(sql);
      count++;
      if(count===failAt) throw new Error('SECRET_PROVIDER_ERROR_0123456789');
      if(sql.includes("current_setting('transaction_read_only')"))
        return {rows:[{read_only:readOnly}]};
      return {rows:[]};
    },
    release(discard){released.push(discard===true);}
  };
  return {client,calls,released,connect:async()=>client,end:async()=>{}};
};

test('schema probe is read-only, bounded, fixed-query, and returns no data',async()=>{
  const p=makePool();
  assert.equal(await probeCivicSourceSchema(p),true);
  assert.deepEqual(p.calls,[
    'BEGIN READ ONLY',
    "SELECT current_setting('transaction_read_only')::text AS read_only",
    ...SOURCE_QUERIES,
    'ROLLBACK',
  ]);
  assert.deepEqual(p.released,[false]);
  assert.equal(SOURCE_QUERIES.length,4);
  for(const q of SOURCE_QUERIES){
    assert.match(q,/^SELECT .* FROM public\.(eci|iniziative_ministero|iniziative_popolari|referendum_abrogativi) LIMIT 0$/);
    assert.doesNotMatch(q,/\b(INSERT|UPDATE|DELETE|ALTER|TRUNCATE|DROP|pg_sleep|dblink)\b/i);
  }
});

test('transaction is rolled back and connection discarded when a source fails',async()=>{
  for(const failAt of [1,2,3,6]){
    const p=makePool({failAt});
    await assert.rejects(probeCivicSourceSchema(p),
      e=>e.message==='STAGING_CIVIC_SOURCE_SCHEMA_UNAVAILABLE' &&
         !e.message.includes('SECRET_PROVIDER_ERROR'));
    assert.equal(p.calls[0],'BEGIN READ ONLY');
    assert.equal(p.calls.at(-1),'ROLLBACK');
    assert.deepEqual(p.released,[true]);
  }
  const p=makePool({readOnly:'off'});
  await assert.rejects(probeCivicSourceSchema(p),/SCHEMA_UNAVAILABLE/);
  assert.deepEqual(p.released,[true]);
});

test('server returns fixed safe statuses and ignores all API and write routes',async(t)=>{
  const server=createCivicReadOnlyServer({sourceProbe:async()=>true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const get=async route=>{
    const r=await fetch(base+route);return {status:r.status,body:await r.json()};
  };
  const live=await get('/health/live');
  assert.equal(live.status,200);
  assert.deepEqual(live.body,{status:'source_canary_only',
    app_ready:false,notifications_enabled:false});
  assert.equal((await get('/health')).status,200);
  const source=await get('/health/civic-sources');
  assert.equal(source.status,200);
  assert.deepEqual(source.body,{status:'read_only_source_schema_passed',
    app_ready:false,notifications_enabled:false});
  const ready=await get('/health/ready');
  assert.equal(ready.status,503);
  assert.equal(ready.body.status,'not_ready');
  for(const route of ['/api/eci','/api/iniziative-popolari',
    '/api/referendum-abrogativi','/api/auth/login','/api/admin',
    '/api/fcm-tokens','/api/civic-push','/health/civic-sources?token=x',
    '/health/civic-sources/','/health%2fcivic-sources','//health/civic-sources']){
    const r=await get(route);
    assert.equal(r.status,404,route);
  }
  const forbidden=await fetch(base+'/health/civic-sources',{method:'POST',body:'{}'});
  assert.equal(forbidden.status,404);
  const head=await fetch(base+'/health/civic-sources',{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
});

test('source probe failures stay generic, 503 and not an app GO',async(t)=>{
  const server=createCivicReadOnlyServer({
    sourceProbe:async()=>{throw new Error('SECRET_PROVIDER_ERROR');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/health/civic-sources');
  assert.equal(r.status,503);
  const data=await r.json();
  assert.equal(data.status,'source_schema_unavailable');
  assert.equal(JSON.stringify(data).includes('SECRET_PROVIDER_ERROR'),false);
  assert.equal(data.app_ready,false);
});

test('simultaneous checks coalesce; successful probes cache for 15 seconds',async(t)=>{
  let called=0,now=1000;
  const server=createCivicReadOnlyServer({
    now:()=>now,
    sourceProbe:async()=>{called++; await new Promise(resolve=>setTimeout(resolve,15)); return true;}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/health/civic-sources';
  const batch=await Promise.all(Array.from({length:10},()=>fetch(url)));
  assert.equal(batch.every(x=>x.status===200),true);
  assert.equal(called,1);
  await fetch(url);
  assert.equal(called,1);
  now+=15001;
  await fetch(url);
  assert.equal(called,2);
});

test('staging-only startup rejects unauthorized environments before pool creation',async()=>{
  let connections=0;
  const make=()=>{connections++;throw new Error('SHOULD_NOT_OPEN');};
  for(const env of [
    {...safe,DEMOS_UNIFIED_STAGING_MODE:'preflight'},
    {...safe,CIVIC_UNIFIED_STAGING_READY:'false'},
    {...safe,CIVIC_STAGING_PROJECT_REF:'wxnblcqoyjqxktwkcqok'},
    {...safe,CIVIC_PUSH_ENABLED:'true'},
    {...safe,PORT:'0'},
    {...safe,PORT:'65536'},
    {...safe,PORT:'ten'},
  ]){
    await assert.rejects(
      startCivicReadOnlyCanary(env,{createPool:make}),/STAGING_/);
  }
  assert.equal(connections,0);
  assert.equal(checkedPort({PORT:10000}),10000);
});

test('standalone module never imports full app, scheduler, Firebase or user routes',()=>{
  const s=fs.readFileSync(path.join(__dirname,'..','staging',
    'unified_staging_civic_readonly_canary.js'),'utf8');
  assert.doesNotMatch(s,/\brequire\(['"](?:\.\.\/)?(?:app|server|routes\/|jobs\/|firebase)/i);
  assert.doesNotMatch(s,/\b(?:app\.listen|express\(|setInterval\(|cron\.schedule|sendEachForMulticast)\b/);
  assert.match(s,/options:'-c default_transaction_read_only=on'/);
  assert.match(s,/max:2,min:0/);
});


test('authorized standalone canary starts with bounded read-only TLS pool',async(t)=>{
  const net=require('node:net');
  const probe=net.createServer();
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  let options,ended=0,identityCalls=0,sourceCalls=0;
  const fakePool={connect:async()=>({query:async()=>({rows:[]}),
    release:()=>{}}),end:async()=>{ended++;}};
  const started=await startCivicReadOnlyCanary({...safe,PORT:String(port)},{
    createPool:o=>{options=o;return fakePool;},
    verifyIdentity:async p=>{identityCalls++;assert.equal(p,fakePool);return true;},
    sourceProbe:async p=>{sourceCalls++;assert.equal(p,fakePool);return true;},
  });
  t.after(async()=>{
    await new Promise(resolve=>started.server.close(resolve));
    await started.pool.end();
  });
  assert.equal(options.max,2);
  assert.equal(options.min,0);
  assert.equal(options.options,'-c default_transaction_read_only=on');
  assert.equal(options.application_name,'demos_staging_civic_readonly_canary');
  assert.equal(options.connectionString.includes(fakeSecret),true);
  assert.equal(options.ssl.rejectUnauthorized,true);
  assert.equal(identityCalls,1);
  assert.equal(sourceCalls,1);
  const root='http://127.0.0.1:'+port;
  const live=await fetch(root+'/health/live');
  assert.equal(live.status,200);
  assert.equal((await fetch(root+'/health/ready')).status,503);
  assert.equal((await fetch(root+'/health/civic-sources')).status,200);
  assert.equal((await fetch(root+'/api/eci')).status,404);
  assert.equal(ended,0);
});

test('failed DB identity never opens HTTP listener and always closes PG pool',async()=>{
  let ended=0;
  const fakePool={connect:async()=>({query:async()=>({rows:[]}),
    release:()=>{}}),end:async()=>{ended++;}};
  await assert.rejects(
    startCivicReadOnlyCanary({...safe,PORT:'11998'},{
      createPool:()=>fakePool,verifyIdentity:async()=>{
        throw new Error('SENSITIVE_CONNECTION_STRING_PROVIDER_ERROR');
      }
    }),e=>e.message==='STAGING_CIVIC_CANARY_NOT_READY' &&
             !e.message.includes('SENSITIVE'));
  assert.equal(ended,1);
});
