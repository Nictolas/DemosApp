'use strict';

// Source-isolated HTTP route test. Auth middleware and SQL pool are stubbed:
// no real database, Render, Supabase, network service or user data is read.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Module}=require('node:module');

const ROUTE=path.resolve(__dirname,'../routes/admin/database.js');
const source=fs.readFileSync(ROUTE,'utf8');

function isolatedRoutes(environment,override){
  const prev={nodeEnv:process.env.NODE_ENV,override:process.env.ALLOW_DEV_API_SURFACE};
  let queryCalls=0;
  try{
    if(environment===null)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=environment;
    if(override===null)delete process.env.ALLOW_DEV_API_SURFACE;
    else process.env.ALLOW_DEV_API_SURFACE=override;
    const mocked={
      pool:{async query(){queryCalls++;throw Error('UNEXPECTED_DATABASE_ACCESS');}},
      verifyToken:(_req,_res,next)=>next(),
      requireAdmin:(_req,_res,next)=>next()
    };
    const mod=new Module(ROUTE,module);
    mod.filename=ROUTE;
    mod.paths=Module._nodeModulePaths(path.dirname(ROUTE));
    const baseRequire=mod.require.bind(mod);
    mod.require=id=>id==='../../middleware/auth'?mocked:baseRequire(id);
    mod._compile(source,ROUTE);
    const stack=mod.exports.stack||[];
    const mounted=stack.filter(x=>x.route).flatMap(x=>
      Object.keys(x.route.methods).filter(k=>x.route.methods[k]).map(method=>({
        method,path:x.route.path
      }))
    );
    return {mounted,queryCalls};
  }finally{
    if(prev.nodeEnv===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=prev.nodeEnv;
    if(prev.override===undefined)delete process.env.ALLOW_DEV_API_SURFACE;
    else process.env.ALLOW_DEV_API_SURFACE=prev.override;
  }
}

test('production admin cannot mount HTTP ALTER TABLE operation with any override',()=>{
  for(const override of [null,'true','false']){
    const {mounted,queryCalls}=isolatedRoutes('production',override);
    assert.equal(queryCalls,0,'route initialization must not open SQL');
    assert.deepEqual(mounted,[{method:'get',path:'/opinioni-structure'}],
      'prod override '+override+' must offer only the admin read-only route');
  }
});

test('non-production can still register the legacy route without SQL side effects',()=>{
  for(const environment of ['test','development',null]){
    const {mounted,queryCalls}=isolatedRoutes(environment,'false');
    assert.equal(queryCalls,0);
    assert.deepEqual(mounted,[
      {method:'post',path:'/add-opinioni-columns'},
      {method:'get',path:'/opinioni-structure'}
    ]);
  }
});

test('legacy schema change is guarded by NODE_ENV and not admin-only authorization',()=>{
  assert.match(source,/if \(process\.env\.NODE_ENV !== 'production'\) \{\s*router\.post\('\/add-opinioni-columns'/);
  assert.match(source,/router\.get\('\/opinioni-structure', verifyToken, requireAdmin/);
  assert.match(source,/ALTER TABLE opinioni ADD COLUMN/);
  assert.equal((source.match(/router\.post\('\/add-opinioni-columns'/g)||[]).length,1);
});
