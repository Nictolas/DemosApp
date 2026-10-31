'use strict';

// Synthetic local-HTTP-only test. The actual GDPR/privacy route source is
// compiled with the canonical database/auth/audit modules stubbed. No external
// PostgreSQL, Supabase, Render, Redis, user records or credentials are used.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Module}=require('node:module');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const http=require('node:http');

const ROOT=path.resolve(__dirname,'..');
const PRIVACY=path.join(ROOT,'routes/user/privacy-settings.js');
const GDPR_REQUESTS=path.join(ROOT,'routes/user/gdpr-requests.js');
const DB_LEGACY=path.join(ROOT,'config/db.js');
const source=fs.readFileSync(PRIVACY,'utf8');

function loadIsolatedPrivacy(queries,audits){
  let centralPoolRequests=0;
  const pool={
    async query(sql,params){
      queries.push({sql:String(sql),params});
      if(/^\s*SELECT\b/i.test(sql))return {
        rows:[{email_notifications:true,push_notifications:false,
          data_analytics:false,updated_at:'synthetic-time'}]
      };
      if(/^\s*UPDATE\b/i.test(sql))return {
        rows:[{id:'synthetic-user',email_notifications:false,
          push_notifications:true,data_analytics:false,
          updated_at:'synthetic-time'}]
      };
      throw Error('UNEXPECTED_SQL_OPERATION');
    }
  };
  const mocks={
    '../../middleware/auth':{verifyToken:(req,_res,next)=>{
      req.user={id:'synthetic-user'};next();
    }},
    '../../services/auditService':{logAction:async x=>{audits.push(x);}},
    '../../config/database':{getPool:()=>{centralPoolRequests++;return pool;}}
  };
  const mod=new Module(PRIVACY,module);
  mod.filename=PRIVACY;
  mod.paths=Module._nodeModulePaths(path.dirname(PRIVACY));
  const baseRequire=mod.require.bind(mod);
  mod.require=id=>{
    if(id==='../../config/db')throw Error('LEGACY_POOL_IMPORT_FORBIDDEN');
    return Object.hasOwn(mocks,id)?mocks[id]:baseRequire(id);
  };
  mod._compile(source,PRIVACY);
  return {router:mod.exports,centralPoolRequests:()=>centralPoolRequests};
}

async function withServer(task){
  const queries=[],audits=[];
  const routes=loadIsolatedPrivacy(queries,audits);
  const app=express();
  app.use(express.json());
  app.use('/api/user/privacy-settings',routes.router);
  const server=http.createServer(app);
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    await task({origin,queries,audits,centralPoolRequests:routes.centralPoolRequests});
  }finally{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
}

test('GET privacy settings uses exactly the already-shared TLS-canonical pool',async()=>{
  await withServer(async({origin,queries,centralPoolRequests})=>{
    const response=await fetch(origin+'/api/user/privacy-settings');
    assert.equal(response.status,200);
    assert.deepEqual((await response.json()).data,{
      email_notifications:true,push_notifications:false,data_analytics:false
    });
    assert.equal(centralPoolRequests(),1);
    assert.equal(queries.length,1);
    assert.match(queries[0].sql,/SELECT\s+email_notifications/i);
    assert.deepEqual(queries[0].params,['synthetic-user']);
  });
});

test('PUT privacy settings writes through canonical pool, preserves parameter binding',async()=>{
  await withServer(async({origin,queries,audits,centralPoolRequests})=>{
    const response=await fetch(origin+'/api/user/privacy-settings',{
      method:'PUT',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({email_notifications:false,push_notifications:true})
    });
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.success,true);
    assert.equal(result.data.email_notifications,false);
    assert.equal(centralPoolRequests(),1);
    assert.equal(queries.length,1);
    assert.match(queries[0].sql,/UPDATE users\s+SET/i);
    assert.deepEqual(queries[0].params.slice(0,2),[false,true]);
    assert.equal(queries[0].params.at(-1),'synthetic-user');
    assert.equal(audits.length,1);
    assert.equal(audits[0].action,'PRIVACY_SETTINGS_UPDATED');
  });
});

test('invalid privacy update is rejected without touching SQL',async()=>{
  await withServer(async({origin,queries})=>{
    const response=await fetch(origin+'/api/user/privacy-settings',{
      method:'PUT',headers:{'content-type':'application/json'},
      body:JSON.stringify({unrelated_option:true})
    });
    assert.equal(response.status,400);
    assert.equal(queries.length,0);
  });
});

test('GDPR route no longer imports independently constructed legacy pool',()=>{
  const privacy=source;
  const requests=fs.readFileSync(GDPR_REQUESTS,'utf8');
  const legacy=fs.readFileSync(DB_LEGACY,'utf8');
  assert.doesNotMatch(privacy,/require\(['"]\.\.\/\.\.\/config\/db['"]\)/);
  assert.match(privacy,/const \{ getPool \} = require\(['"]\.\.\/\.\.\/config\/database['"]\)/);
  // The rights-requests route is owned by PR #376, which replaces the
  // legacy Pool with a TLS-safe compatibility module and persists receipts.
  // Avoid modifying the same path in PR #374: both open drafts must compose.
  assert.match(requests,/require\(['"]\.\.\/\.\.\/config\/db['"]\)/);
  assert.match(legacy,/new Pool\(config\)/);
  // The legacy source remains for the development SQL diagnostic. The
  // production routes that process privacy settings must not depend on it.
});
