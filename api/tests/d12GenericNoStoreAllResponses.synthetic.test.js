'use strict';
// Real route source with isolated synthetic Router/middleware/DB: header must
// be attached BEFORE authentication and validation, including early errors.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../routes/subject-proposals.js'),'utf8');

function makeRouter({databaseDown=false}={}){
  const registered=new Map();
  const middleware=[];
  const calls=[];
  const pool={
    query:async()=>{calls.push('query');throw new Error('SYNTHETIC_DATABASE_OFFLINE')},
    connect:async()=>{calls.push('connect');throw new Error('SYNTHETIC_DATABASE_OFFLINE')}
  };
  const router={
    use(fn){middleware.push(fn);return this},
    get(route,...fns){registered.set('GET '+route,fns);return this},
    post(route,...fns){registered.set('POST '+route,fns);return this}
  };
  const verifyToken=(req,res,next)=>{
    if(!req.authenticated)return res.status(401).json({success:false,error:'Auth required'});
    req.user={id:'11111111-1111-4111-8111-111111111111',isAdmin:!!req.admin};
    next();
  };
  const requireAdmin=(req,res,next)=>{
    if(!req.user?.isAdmin)return res.status(403).json({success:false,error:'Admin required'});
    next();
  };
  const stubs={
    express:{Router:()=>router},
    '../config/database':{getPool:()=>pool},
    '../middleware/auth':{verifyToken,requireAdmin},
    '../utils/recognitionEvidence':{validateEvidenceUrl:()=>true},
    '../utils/thirdPartyNominationGate':{
      isNominationWriteEnabled:()=>false,
      rejectUnavailableNomination:res=>res.status(503).json({success:false,error:'PROPOSTE_NON_DISPONIBILI'})
    },
    '../services/publicApprovedSubjectPage':{
      readApprovedPage:async()=>{
        if(databaseDown)throw Error('SYNTHETIC_PUBLIC_DB_OFFLINE');
        return {data:[{id:'synthetic-public-item',title:'Persona sintetica'}],next_cursor:null};
      }
    }
  };
  const module={exports:{}};
  vm.runInNewContext(source,{
    module,
    require:name=>{
      if(!(name in stubs))throw Error('Unexpected module '+name);
      return stubs[name];
    },
    process:{env:{}},Buffer,URL,Set,console
  },{filename:'subject-proposals.js'});
  assert.equal(module.exports,router);
  async function run(method,route,{authenticated=false,admin=false,query={},body={},params={}}={}){
    const req={authenticated,admin,query,body,params};
    const res={
      statusCode:200,body:null,headers:{},
      set(name,value){this.headers[name]=value;return this},
      status(code){this.statusCode=code;return this},
      json(body){this.body=body;return this}
    };
    const fns=[...middleware,...(registered.get(method+' '+route)||[])];
    assert.ok(fns.length>middleware.length,'route is actually registered '+route);
    for(const fn of fns){
      let calledNext=false;
      await fn(req,res,()=>{calledNext=true});
      if(!calledNext)break;
    }
    return res;
  }
  return {run,middleware,calls};
}

test('router-wide cache protection is installed before authentication and all endpoints',()=>{
  const app=makeRouter();
  assert.equal(app.middleware.length,1);
});
test('401 authentication failures and 403 Admin denials never become cacheable',async()=>{
  const app=makeRouter();
  for(const [route,options,status] of [
    ['/mine',{},401],
    ['/admin',{},401],
    ['/admin',{authenticated:true},403],
    ['/admin/approved',{authenticated:true},403],
    ['/admin/notification-audit',{authenticated:true},403],
    ['/admin/withdraw-notifications',{authenticated:true},403]
  ]){
    const res=await app.run('GET',route,options);
    assert.equal(res.statusCode,status,route);
    assert.match(res.headers['Cache-Control'],/private,\s*no-store/);
  }
  assert.deepEqual(app.calls,[],'authentication must deny before SQL');
});
test('validation 400, wrong queue 409, and gated writes 503 always have no-store',async()=>{
  const app=makeRouter();
  for(const [method,route,options,status] of [
    ['GET','/mine',{authenticated:true,query:{category:'unknown'}},400],
    ['GET','/approved',{query:{category:'unknown'}},400],
    ['GET','/admin',{authenticated:true,admin:true,query:{cursor:'!!'}},400],
    ['POST','/',{authenticated:true,body:{category:'grazia',title:'Persona sintetica',source_url:'https://example.org/fonte'}},409],
    ['POST','/',{authenticated:true,body:{category:'attivisti',title:'Persona sintetica',source_url:'https://example.org/fonte'}},503]
  ]){
    const res=await app.run(method,route,options);
    assert.equal(res.statusCode,status,route);
    assert.match(res.headers['Cache-Control'],/private,\s*no-store/);
  }
  assert.deepEqual(app.calls,[],'validation/gate errors must not access SQL');
});
test('private 503 on database outage and public successful directory both forbid caching',async()=>{
  const app=makeRouter({databaseDown:true});
  for(const [method,route,options,status] of [
    ['GET','/mine',{authenticated:true,query:{category:'attivisti'}},503],
    ['GET','/admin',{authenticated:true,admin:true},503],
    ['GET','/approved',{query:{category:'attivisti'}},503]
  ]){
    const res=await app.run(method,route,options);
    assert.equal(res.statusCode,status,route);
    assert.match(res.headers['Cache-Control'],/no-store/);
    assert.equal(JSON.stringify(res.body).includes('SYNTHETIC_'),false);
  }
  const published=await makeRouter().run('GET','/approved',{query:{category:'attivisti'}});
  assert.equal(published.statusCode,200);
  assert.match(published.headers['Cache-Control'],/no-store/);
  assert.deepEqual(published.body.data,[{id:'synthetic-public-item',title:'Persona sintetica'}]);
});


test('Admin decision rejects malformed UUIDs before any SQL',async()=>{
  const app=makeRouter();
  const base={authenticated:true,admin:true,body:{decision:'reject',note:'Synthetic review only'}};
  for(const id of ['-'.repeat(36),'a'.repeat(36),'12345678-1234-1234-1234-123456789abz',
                   '12345678123412341234123456789abc','12345678-1234-1234-1234-123456789abc-']){
    const res=await app.run('POST','/admin/:id/decision',{...base,params:{id}});
    assert.equal(res.statusCode,400,'reject malformed ID before PostgreSQL UUID cast');
    assert.equal(res.body?.success,false);
    assert.match(res.headers['Cache-Control'],/private,\s*no-store/);
  }
  assert.deepEqual(app.calls,[],'no database connection for invalid Admin IDs');
  const valid=await app.run('POST','/admin/:id/decision',{
    ...base,params:{id:'22222222-2222-4222-8222-222222222222'}
  });
  assert.equal(valid.statusCode,503,'canonical UUID reaches only synthetic offline pool');
  assert.deepEqual(app.calls,['connect'],'valid input continues to existing transaction path');
});
