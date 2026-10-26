'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// Evaluate the actual route source in a synthetic Express environment.
// Any attempted SQL, pg Pool creation or loading of a real DB dependency
// causes the test to fail. No server/listener is opened and no data is read.
function loadProtectedRouter(file) {
  const routes=new Map(),guards=[];
  const router={
    use(...handlers){guards.push(...handlers);},
    post(route,handler){routes.set(route,handler);}
  };
  const auth={
    verifyToken: function verifyToken(){},
    requireAdmin: function requireAdmin(){}
  };
  const source=fs.readFileSync(path.join(__dirname,'..','routes',file),'utf8');
  const sandbox={
    module:{exports:null},
    require(name){
      if(name==='express')return {Router:()=>router};
      if(name==='../middleware/auth')return auth;
      throw Error('Unexpected dependency/possible DB access: '+name);
    }
  };
  vm.runInNewContext(source,sandbox,{filename:file,timeout:500});
  assert.equal(sandbox.module.exports,router);
  assert.deepEqual(guards,[auth.verifyToken,auth.requireAdmin]);
  assert.doesNotMatch(source,/\bnew\s+Pool\s*\(|\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|users)|ALTER\s+TABLE/i);
  return routes;
}
async function response(handler,body={}) {
  const data={status:200,headers:{}};
  const res={
    set(k,v){data.headers[k]=v;return res;},
    status(code){data.status=code;return res;},
    json(value){data.body=value;return res;}
  };
  await handler({body,headers:{'x-migration-key':'synthetic'}},res);
  return data;
}
test('both dev-only destructive account cleanup routes are retired, including explicit email input',async()=>{
  const routes=loadProtectedRouter('cleanup.js');
  assert.deepEqual([...routes.keys()].sort(),['/delete-temporary-users','/delete-test-user'].sort());
  for(const [name,handler] of routes) {
    const result=await response(handler,{email:'synthetic@example.invalid'});
    assert.equal(result.status,410,name);
    assert.equal(result.body.success,false);
    assert.equal(result.body.code,'LEGACY_USER_CLEANUP_RETIRED');
    assert.equal(result.headers['Cache-Control'],'no-store');
    assert.equal(JSON.stringify(result).includes('synthetic@example.invalid'),false);
  }
});
test('old HTTP political consent schema migration is retired irrespective of old fallback secret',async()=>{
  const routes=loadProtectedRouter('migrations.js');
  assert.deepEqual([...routes.keys()],['/add-political-opinions-consent-columns']);
  const result=await response(routes.get('/add-political-opinions-consent-columns'),{
    migrationKey:'TEMPORARY_MIGRATION_KEY_CHANGE_ME'
  });
  assert.equal(result.status,410);
  assert.equal(result.body.code,'LEGACY_HTTP_GDPR_MIGRATION_RETIRED');
  assert.equal(JSON.stringify(result).includes('TEMPORARY_MIGRATION_KEY_CHANGE_ME'),false);
});
