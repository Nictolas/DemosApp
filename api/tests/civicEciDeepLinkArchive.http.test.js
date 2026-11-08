'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const records = [
  {id:'2026-000011',title:'Official ongoing initiative',status:'ONGOING',
   signature_count:3,slug:null,end_date:null,obiettivi:'Official objectives',url:null},
  {id:'2025-000004',title:'Official past initiative',status:'NOT_ONGOING',
   signature_count:2,slug:null,end_date:null,obiettivi:'Archived objectives',url:null},
];
const calls=[];
let providerFailure=false;
const pool={async query(sql,params){
  calls.push({sql,params});
  if(providerFailure) throw new Error('SECRET_DATABASE_PASSWORD_IN_ERROR');
  if(sql.includes("WHERE status = 'ONGOING'")) {
    return {rows:records.filter(r=>r.status==='ONGOING')};
  }
  if(sql.includes('WHERE id = $1')) {
    assert.match(sql,/status IS DISTINCT FROM 'ONGOING'/);
    assert.match(sql,/LIMIT 1/);
    assert.equal(params?.length,1);
    return {rows:records.filter(r=>r.id===params[0] && r.status!=='ONGOING')};
  }
  throw new Error('unexpected SQL in HTTP integration test');
}};

// Load exactly the ECI route with a synthetic in-memory database. Do not
// import or connect the real middleware/auth pool, staging or production.
const authPath=require.resolve('../middleware/auth');
require.cache[authPath]={
  id:authPath,filename:authPath,loaded:true,exports:{pool},
};
const router=require('../routes/eci');
const client=fs.readFileSync(path.resolve(__dirname,
  '../../client/src/pages/ECI/index.tsx'),'utf8');

test('ECI API resolves closed push notification by official ID only on demand',async(t)=>{
  const app=express();
  app.use('/api/eci',router);
  const server=await new Promise(resolve=>{
    const server=app.listen(0,'127.0.0.1',()=>resolve(server));
  });
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const get=async suffix=>{
    const r=await fetch(base+'/api/eci'+suffix);
    return {status:r.status,body:await r.json()};
  };

  calls.length=0;
  const normal=await get('');
  assert.equal(normal.status,200);
  assert.equal(calls.length,1,'normal list must be one SQL query');
  assert.deepEqual(normal.body.initiatives.map(r=>r.id),['2026-000011']);
  assert.deepEqual(normal.body.ongoing.map(r=>r.id),['2026-000011']);

  calls.length=0;
  const active=await get('?initiative=2026-000011');
  assert.equal(active.status,200);
  assert.equal(calls.length,1,'active push must reuse the already loaded list');

  calls.length=0;
  const historical=await get('?initiative=2025-000004');
  assert.equal(historical.status,200);
  assert.equal(calls.length,2,'archived push makes at most one targeted SQL read');
  assert.equal(calls[1].params[0],'2025-000004');
  assert.deepEqual(historical.body.initiatives.map(r=>r.id),
    ['2026-000011','2025-000004']);
  assert.deepEqual(historical.body.ongoing.map(r=>r.id),
    ['2026-000011'],'past ECI must not pollute live list');
  assert.equal(historical.body.initiatives[1].obiettivi,'Archived objectives');

  calls.length=0;
  const missing=await get('?initiative=2024-000001');
  assert.equal(missing.status,200);
  assert.equal(calls.length,2);
  assert.deepEqual(missing.body.initiatives.map(r=>r.id),['2026-000011']);

  for(const invalid of [
    'bad-id','2025-000004%27%20OR%201%3D1','2025-000004&initiative=2026-000011',
    '2025000004','a'.repeat(200),
  ]) {
    calls.length=0;
    const response=await get('?initiative='+invalid);
    assert.equal(response.status,400,invalid);
    assert.equal(calls.length,0,'invalid ID must not trigger a DB query');
    assert.ok(!JSON.stringify(response.body).includes('password'));
  }

  calls.length=0;
  providerFailure=true;
  const originalError=console.error;
  const logs=[];
  console.error=(...args)=>logs.push(args.join(' '));
  try {
    const failed=await get('?initiative=2025-000004');
    assert.equal(failed.status,503);
    assert.equal(JSON.stringify(failed.body).includes('SECRET_DATABASE_PASSWORD'),false);
    assert.equal(logs.join('').includes('SECRET_DATABASE_PASSWORD'),false);
  } finally {
    providerFailure=false;
    console.error=originalError;
  }
});

test('ECI frontend requests a missing official archive by ID without another page/SQL scan',()=>{
  assert.match(client,/queryKey: \["eci", "initiatives", deepLinkId\]/);
  assert.match(client,/encodeURIComponent\(deepLinkId\)/);
  assert.match(client,/const archived = \(eciData\?\.initiatives \|\| \[\]\)\.find/);
  assert.match(client,/setViewItem\(toItem\(archived\)\)/);
  assert.match(client,/const item = baseList\.find/);
});
