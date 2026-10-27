'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const flag='DEMOS_PRIVACY_RECOVERY_MAINTENANCE';

async function mode(value,fn){
  const was=process.env[flag];
  try{if(value===undefined)delete process.env[flag];else process.env[flag]=value;return await fn();}
  finally{if(was===undefined)delete process.env[flag];else process.env[flag]=was;}
}

function loadRouter(routePath,{query=async()=>({rows:[]})}={}){
  let newPools=0;
  const routes=new Map(),uses=[];
  const express={
    Router:()=>({
      use(...args){uses.push(...args);},
      post(p,...handlers){routes.set('POST '+p,handlers);},
      put(p,...handlers){routes.set('PUT '+p,handlers);},
      get(p,...handlers){routes.set('GET '+p,handlers);}
    })
  };
  const middleware={verifyToken:function verifyToken(){},requireAdmin:function requireAdmin(){},pool:{query}};
  const stubPool={async query(...args){return query(...args);}};
  const source=fs.readFileSync(path.join(__dirname,'..','routes',routePath),'utf8');
  const context={
    module:{exports:null},process,
    console:{log(){},error(){},warn(){}},
    require(name){
      if(name==='express')return express;
      if(name==='pg')return {Pool:class {constructor(){newPools++;}async query(...args){return stubPool.query(...args);}}};
      if(name==='dotenv')return {config(){}};
      if(name==='../middleware/auth'||name==='../../middleware/auth')return middleware;
      if(name==='../middleware/privacyRecoveryMaintenance')
        return {isPrivacyRecoveryMaintenanceActive:()=>process.env[flag]!==undefined&&process.env[flag]!=='false'};
      throw Error('Unexpected dependency '+name);
    }
  };
  vm.runInNewContext(source,context,{filename:routePath,timeout:500});
  assert.ok(context.module.exports);
  return {routes,uses,middleware,getNewPools:()=>newPools,source};
}

async function response(handler,params={},body={tipologie:['politica']},user={id:'user-1'}){
  const data={status:200,headers:{}};
  const res={
    set(k,v){data.headers[k]=v;return res;},
    status(code){data.status=code;return res;},
    json(value){data.body=value;return res;}
  };
  await handler({params,body,user},res);
  return data;
}
test('dev migrate-columns path requires admin and never opens PostgreSQL',async()=>{
  const r=loadRouter('migrate-columns.js');
  assert.deepEqual(r.uses,[r.middleware.verifyToken,r.middleware.requireAdmin]);
  const handlers=r.routes.get('POST /columns');
  assert.equal(handlers.length,1);
  const out=await response(handlers[0]);
  assert.equal(out.status,410);
  assert.equal(out.body.code,'LEGACY_HTTP_SCHEMA_MIGRATION_RETIRED');
  assert.equal(out.headers['Cache-Control'],'no-store');
  assert.equal(r.getNewPools(),0);
  assert.doesNotMatch(r.source,/\b(?:ALTER TABLE|CREATE INDEX|new Pool\s*\()/i);
});
test('normally mounted admin opinions migration POST is retired but GET stays read-only',async()=>{
  const seen=[];
  const r=loadRouter('admin/database.js',{async query(sql){
    seen.push(sql);
    if(/information_schema.tables/i.test(sql))return {rows:[{table_name:'opinioni'}]};
    if(/information_schema.columns/i.test(sql))return {rows:[
      {column_name:'approfondimento',data_type:'text',is_nullable:'YES',column_default:null}
    ]};
    throw Error('Unexpected SQL outside metadata');
  }});
  const post=r.routes.get('POST /add-opinioni-columns');
  assert.deepEqual(post.slice(0,2),[r.middleware.verifyToken,r.middleware.requireAdmin]);
  const denied=await response(post[2]);
  assert.equal(denied.status,410);
  assert.equal(denied.body.code,'LEGACY_HTTP_SCHEMA_MIGRATION_RETIRED');
  assert.equal(seen.length,0,'no metadata query or DDL on rejected POST');
  const get=r.routes.get('GET /opinioni-structure');
  assert.deepEqual(get.slice(0,2),[r.middleware.verifyToken,r.middleware.requireAdmin]);
  const inspected=await response(get[2]);
  assert.equal(inspected.status,200);
  assert.equal(inspected.body.tableExists,true);
  assert.equal(seen.length,2);
  assert.ok(seen.every(sql=>/^\s*SELECT\s/i.test(sql)));
  assert.doesNotMatch(r.source,/\bALTER TABLE\b/i);
});
test('user activism UPDATE is rejected before even SELECT during maintenance',async()=>{
  await mode('true',async()=>{
    let calls=0;
    const r=loadRouter('attivismo-tipologie.js',{async query(){calls++;throw Error('Unexpected SQL');}});
    const h=r.routes.get('PUT /:userId');
    assert.equal(h[0],r.middleware.verifyToken);
    const out=await response(h[1],{userId:'user-1'});
    assert.equal(out.status,503);assert.equal(out.body.code,'GDPR_RECOVERY_MAINTENANCE');
    assert.equal(out.headers['Retry-After'],'120');
    assert.equal(calls,0);
  });
});
test('maintenance activated while reading profile prevents independent UPDATE',async()=>{
  await mode('false',async()=>{
    let calls=0;
    const r=loadRouter('attivismo-tipologie.js',{async query(sql){
      calls++;
      if(calls!==1)throw Error('UPDATE escaped maintenance');
      assert.match(sql,/SELECT id, nome, cognome, ruolo FROM users/);
      process.env[flag]='true';
      return {rows:[{id:'user-1',nome:'Synthetic',cognome:'User',ruolo:'citizen'}]};
    }});
    const out=await response(r.routes.get('PUT /:userId')[1],{userId:'user-1'});
    assert.equal(out.status,503);
    assert.equal(out.body.code,'GDPR_RECOVERY_MAINTENANCE');
    assert.equal(calls,1);
  });
});
test('normal user profile update still works when maintenance is false',async()=>{
  await mode('false',async()=>{
    const statements=[];
    const r=loadRouter('attivismo-tipologie.js',{async query(sql){
      statements.push(sql);
      if(statements.length===1)return {rows:[{id:'user-1',nome:'Synthetic',cognome:'User',ruolo:'citizen'}]};
      if(statements.length===2){
        assert.match(sql,/UPDATE users SET tipologie_attivismo/);
        return {rows:[{tipologie_attivismo:'[]'}]};
      }
      throw Error('Too many queries');
    }});
    const out=await response(r.routes.get('PUT /:userId')[1],{userId:'user-1'});
    assert.equal(out.status,200);
    assert.equal(out.body.success,true);
    assert.equal(statements.length,2);
  });
});
test('unauthorized user never performs activism UPDATE',async()=>{
  await mode('false',async()=>{
    let calls=0;
    const r=loadRouter('attivismo-tipologie.js',{async query(){
      calls++;return {rows:[{id:'user-2',nome:'Synthetic',cognome:'User',ruolo:'citizen'}]};
    }});
    const out=await response(r.routes.get('PUT /:userId')[1],{userId:'user-2'});
    assert.equal(out.status,403);assert.equal(calls,1);
  });
});
