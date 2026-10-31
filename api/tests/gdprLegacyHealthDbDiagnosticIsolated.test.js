'use strict';

// Local HTTP regression, with the database module fully replaced by an
// in-memory stub. This test must NEVER access an external database or Render.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Module}=require('node:module');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const express=require('express');

const ROUTE=path.resolve(__dirname,'../routes/health.js');
const SOURCE=fs.readFileSync(ROUTE,'utf8');

async function withHealthRouter(environment,devOverride,callback){
  const old={NODE_ENV:process.env.NODE_ENV,
    DATABASE_URL:process.env.DATABASE_URL,
    ALLOW_DEV_API_SURFACE:process.env.ALLOW_DEV_API_SURFACE};
  let poolCalls=0,sqlQueries=0,server;
  try{
    process.env.NODE_ENV=environment;
    process.env.DATABASE_URL='synthetic://not-a-real-database';
    process.env.ALLOW_DEV_API_SURFACE=devOverride;
    const fakeDatabase={
      getPool(){
        poolCalls++;
        return {async connect(){
          return {
            async query(sql){
              sqlQueries++;
              assert.equal(sql,'SELECT NOW() as current_time');
              return {rows:[{current_time:'2026-10-29T00:00:00.000Z'}]};
            },
            release(){}
          };
        }};
      }
    };
    // Compile a fresh route with stubbed require, independent of global
    // module cache. No real Pool or API connection can be created.
    const isolated=new Module(ROUTE,module);
    isolated.filename=ROUTE;
    isolated.paths=Module._nodeModulePaths(path.dirname(ROUTE));
    const originalRequire=isolated.require.bind(isolated);
    isolated.require=id=>id==='../config/database'
      ?fakeDatabase:originalRequire(id);
    isolated._compile(SOURCE,ROUTE);
    const app=express();
    app.use('/api',isolated.exports);
    app.use((_req,res)=>res.status(404).json({error:'not_found'}));
    server=http.createServer(app);
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
    const get=async route=>{
      const result=await fetch('http://127.0.0.1:'+server.address().port+route,{
        signal:AbortSignal.timeout(2000)
      });
      return {status:result.status,body:await result.json()};
    };
    await callback({get,counts:()=>({poolCalls,sqlQueries})});
  } finally {
    if(server)await new Promise(resolve=>server.close(()=>resolve()));
    for(const [name,value] of Object.entries(old)){
      if(value===undefined)delete process.env[name];
      else process.env[name]=value;
    }
  }
}

test('production GET /api/test-db responds 404 without ever touching a pool',async()=>{
  await withHealthRouter('production','false',async({get,counts})=>{
    const result=await get('/api/test-db');
    assert.equal(result.status,404);
    assert.deepEqual(result.body,{error:'not_found'});
    assert.deepEqual(counts(),{poolCalls:0,sqlQueries:0});
  });
});

test('production dev override cannot expose SQL diagnostic; health stays available',async()=>{
  await withHealthRouter('production','true',async({get,counts})=>{
    assert.equal((await get('/api/test-db')).status,404);
    const health=await get('/api/health');
    assert.equal(health.status,200);
    assert.equal(health.body.success,true);
    assert.deepEqual(counts(),{poolCalls:0,sqlQueries:0});
  });
});

test('non-production diagnostic still uses only the stub SQL connection',async()=>{
  await withHealthRouter('test','false',async({get,counts})=>{
    const result=await get('/api/test-db');
    assert.equal(result.status,200);
    assert.equal(result.body.success,true);
    assert.equal(result.body.dbTime,'2026-10-29T00:00:00.000Z');
    assert.deepEqual(counts(),{poolCalls:1,sqlQueries:1});
  });
});
