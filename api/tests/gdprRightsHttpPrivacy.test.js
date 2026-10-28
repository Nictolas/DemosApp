'use strict';
// Real Express HTTP responses, synthetic services only. No provider or DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

async function withServer({pool, audit} = {}, run) {
  const paths = [
    '../middleware/auth', '../config/db', '../services/auditService',
    '../utils/emailCrypto', '../routes/user/gdpr-rights',
    '../routes/user/gdpr-requests'
  ].map(path => require.resolve(path));
  const previous = paths.map(path => require.cache[path]);
  let server;
  const database = pool || {async query(sql, args) {
    if (sql.includes('complete_visibility')) return {rows:[{
      complete_visibility:true, id:null
    }]};
    if (sql.includes('INSERT INTO public.user_rights_requests')) {
      return {rowCount:1,rows:[{
        id:args[0],request_type:args[2],status:'pending',
        created_at:'2026-10-28T00:00:00Z'
      }]};
    }
    if (sql.includes('FROM users u')) return {rows:[{
      id:'synthetic-user',email:'synthetic@example.invalid',premium:false
    }]};
    return {rows:[]};
  }};
  const mocks = [
    {pool:database,verifyToken(req,res,next) {
      if (req.headers.authorization !== 'Bearer synthetic') {
        return res.status(401).json({success:false});
      }
      req.userId='synthetic-user';
      next();
    }},
    {pool:database},
    audit || {logAction:async()=>{},getUserAuditLogs:async()=>[]},
    {decrypt:value=>value}
  ];
  try {
    for (let i=0;i<4;i++) require.cache[paths[i]]={
      id:paths[i],filename:paths[i],loaded:true,exports:mocks[i]
    };
    for (const path of paths.slice(4)) delete require.cache[path];
    const app=express();
    app.use(express.json());
    // Preserve the application's actual mount order. In particular, the
    // first router can reject the /gdpr-requests alias before its handler.
    app.use('/api/user',require('../routes/user/gdpr-rights'));
    app.use('/api/user/gdpr-requests',require('../routes/user/gdpr-requests'));
    app.get('/api/user/unrelated',(_req,res)=>res.json({success:true}));
    server=await new Promise(resolve=>{
      const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));
    });
    const origin='http://127.0.0.1:'+server.address().port;
    await run(async(path,options={})=>fetch(origin+path,{
      ...options,
      headers:{authorization:'Bearer synthetic',...options.headers},
      signal:AbortSignal.timeout(3000)
    }));
  } finally {
    if (server) await new Promise(resolve=>{
      server.close(resolve);
      server.closeAllConnections();
    });
    for (let i=0;i<paths.length;i++) {
      delete require.cache[paths[i]];
      if (previous[i]) require.cache[paths[i]]=previous[i];
    }
  }
}

function noStore(response,status) {
  assert.equal(response.status,status);
  assert.equal(response.headers.get('cache-control'),
    'private, no-store, max-age=0');
}

test('GDPR exports and both histories forbid HTTP caching on success',async()=>{
  await withServer({},async request=>{
    for (const path of [
      '/api/user/data-export', '/api/user/data-export?format=csv',
      '/api/user/rights-requests', '/api/user/gdpr-requests'
    ]) {
      const response=await request(path);
      noStore(response,200);
      await response.text();
    }
    const saved=await request('/api/user/gdpr-requests',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({tipo:'access',dettagli:'synthetic'})
    });
    noStore(saved,201);
    assert.equal((await saved.json()).success,true);
    const unrelated=await request('/api/user/unrelated');
    assert.equal(unrelated.status,200);
    assert.equal(unrelated.headers.get('cache-control'),null);
  });
});

test('GDPR authentication, validation and retired deletion responses forbid caching',async()=>{
  await withServer({},async request=>{
    for (const path of [
      '/api/user/data-export','/api/user/rights-requests',
      '/api/user/gdpr-requests'
    ]) {
      noStore(await request(path,{headers:{authorization:''}}),401);
    }
    for (const [path,options] of [
      ['/api/user/data-export?format=invalid',{}],
      ['/api/user/rights-requests?limit=0',{}],
      ['/api/user/gdpr-requests?offset=-1',{}],
      ['/api/user/limit-processing',{method:'PUT',headers:{'content-type':'application/json'},body:'{}'}],
      ['/api/user/object',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}]
    ]) noStore(await request(path,options),400);
    noStore(await request('/api/user/account',{method:'DELETE'}),410);
  });
});

test('GDPR DB errors stay private and export still responds if error audit rejects',async()=>{
  const errors=[];
  const original=console.error;
  console.error=(...args)=>errors.push(args);
  const sensitive='synthetic-private-sql-detail';
  const auditCalls=[];
  try {
    await withServer({
      pool:{async query(){throw Error(sensitive);}},
      audit:{
        async logAction(event){
          auditCalls.push(event);
          if (!event.success) throw Error(sensitive);
        },
        async getUserAuditLogs(){return [];}
      }
    },async request=>{
      for (const path of ['/api/user/rights-requests','/api/user/gdpr-requests']) {
        const response=await request(path);
        noStore(response,503);
        assert.equal((await response.json()).success,false);
      }
      const response=await request('/api/user/data-export');
      noStore(response,500);
      const body=await response.json();
      assert.equal(body.success,false);
      assert.equal(JSON.stringify(body).includes(sensitive),false);
    });
    assert.equal(JSON.stringify(errors).includes(sensitive),false);
    assert.equal(auditCalls.at(-1).errorMessage,'GDPR_DATA_EXPORT_FAILED');
    assert.ok(errors.some(args=>
      args[0]==='GDPR_DATA_EXPORT_SECONDARY_AUDIT_UNAVAILABLE'));
  } finally {console.error=original;}
});
