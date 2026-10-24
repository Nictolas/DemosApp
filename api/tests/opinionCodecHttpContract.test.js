'use strict';

/**
 * Isolated HTTP contract test for the ACTUAL deployed-route source files.
 * No Supabase, no external calls, no SQL DDL. The PostgreSQL pool and JWT
 * verification are injected through Node's require cache; all data is fake.
 * The 2-bit adapter is compared against unchanged legacy HTTP JSON.
 * This is NOT proof of Android-device compatibility or production RLS.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const express=require('express');
const {createCatalogRegistry,encodeEnvelope,decodeLegacyQuestionRows}=
  require('../utils/opinionCodecEnvelope');

const ROOT=path.resolve(__dirname,'..');
const paths={
  auth:require.resolve(path.join(ROOT,'middleware/auth.js')),
  jwt:require.resolve(path.join(ROOT,'utils/jwt.js')),
  civic:require.resolve(path.join(ROOT,'middleware/civicIdentity.js')),
  compat:require.resolve(path.join(ROOT,'routes/compatibility.js')),
  answers:require.resolve(path.join(ROOT,'routes/opinioni/user-answers.js')),
  notifications:require.resolve(path.join(ROOT,'services/politicalOpinionNotificationService.js')),
  push:require.resolve(path.join(ROOT,'services/currentSupporterPushService.js'))
};
const IDS=['caccia','nato','salario_minimo','energia_nucleare'];
const QUESTIONS=IDS.map((id,index)=>({
  id,text:'Synthetic question '+index,gradi_opinione:['N']
}));
const registry=createCatalogRegistry([{version:1,ids:IDS}]);

async function withActualRoutes(fn){
  const old=new Map(Object.values(paths).map(p=>[p,require.cache[p]]));
  const answers=new Map();
  const consents=new Map([['account-a',true],['account-b',true]]);
  const calls=[];
  const pool={
    async query(statement,params=[]){
      const sql=String(statement).replace(/\s+/g,' ').trim();
      calls.push({sql,params});
      if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[],rowCount:0};
      if(sql.startsWith('SELECT id, status, ruolo FROM users')){
        const id=params[0];
        if(id==='inactive')return {rows:[{id,status:'p',ruolo:'user'}],rowCount:1};
        return ['account-a','account-b'].includes(id)?
          {rows:[{id,status:'a',ruolo:'user'}],rowCount:1}:
          {rows:[],rowCount:0};
      }
      if(sql.includes('AS granted')&&sql.includes('user_consents')){
        return {rows:[{granted:consents.get(params[0])===true}],rowCount:1};
      }
      if(sql.includes('FROM opinioni_domande o')&&sql.includes('ORDER BY o.text')){
        const rows=QUESTIONS.filter(q=>q.gradi_opinione.includes(params[0]));
        return {rows,rowCount:rows.length};
      }
      if(sql.startsWith('SELECT * FROM opinioni_risposte WHERE user_id')){
        const row=answers.get(params[0]);
        return {rows:row?[{...row}]:[],rowCount:row?1:0};
      }
      if(sql.includes('information_schema.columns')&&sql.includes('opinioni_risposte')){
        const rows=params[0].filter(id=>IDS.includes(id)).map(column_name=>({column_name}));
        return {rows,rowCount:rows.length};
      }
      if(sql.includes('FROM opinioni_risposte')&&sql.includes('FOR UPDATE')){
        const row=answers.get(params[0]);
        return {rows:row?[{...row}]:[],rowCount:row?1:0};
      }
      if(sql.startsWith('INSERT INTO opinioni_risposte')){
        const m=/INSERT INTO opinioni_risposte \(([^)]+)\)/.exec(sql);
        if(!m)throw Error('Unexpected INSERT SQL');
        const columns=m[1].split(',').map(s=>s.trim().replace(/^"|"$/g,''));
        const row=Object.fromEntries(columns.map((key,i)=>[key,params[i]]));
        answers.set(params[0],row);
        return {rows:[],rowCount:1};
      }
      if(sql.startsWith('UPDATE opinioni_risposte SET')){
        const m=/^UPDATE opinioni_risposte SET (.+) WHERE user_id = \$(\d+)/.exec(sql);
        if(!m)throw Error('Unexpected UPDATE SQL');
        const row=answers.get(params.at(-1));
        if(!row)return {rows:[],rowCount:0};
        for(const item of m[1].split(',')){
          const match=/^([a-z][a-z0-9_]*) = \$(\d+)$/.exec(item.trim());
          if(!match)throw Error('Unexpected column update');
          row[match[1]]=params[Number(match[2])-1];
        }
        return {rows:[],rowCount:1};
      }
      throw Error('Unexpected SQL in synthetic HTTP test: '+sql);
    },
    async connect(){return {query:(...args)=>pool.query(...args),release(){}};}
  };
  const fake=(p,exports)=>{require.cache[p]={id:p,filename:p,loaded:true,exports};};
  fake(paths.auth,{
    pool,
    verifyToken(req,res,next){
      const token=req.get('authorization')?.replace(/^Bearer /,'');
      if(!['account-a','account-b','inactive'].includes(token))
        return res.status(401).json({success:false,error:'Autenticazione richiesta'});
      req.userId=token;
      req.user={id:token,isAdmin:false,isPolitician:false,isCandidate:false};
      next();
    },
    requireAdmin:(_req,res)=>res.status(403).end()
  });
  fake(paths.jwt,{
    verifyAccessToken(token){
      if(!['account-a','account-b','inactive'].includes(token))throw Error('Invalid JWT');
      return {userId:token};
    }
  });
  fake(paths.civic,{requireVerifiedCivicIdentity:(_req,res)=>res.status(403).end()});
  fake(paths.notifications,{createSupporterOpinionNotifications:async()=>({created:0})});
  fake(paths.push,{sendPushToCurrentSupporters:async()=>0});
  delete require.cache[paths.compat];
  delete require.cache[paths.answers];
  const app=express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api',require(paths.compat));
  app.use('/api/opinioni',require(paths.answers));
  const server=http.createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const request=async(method,url,token,body,extraHeaders={},cacheMode='default')=>{
    const response=await fetch(base+url,{
      method,
      cache:cacheMode,
      headers:{
        ...(token?{authorization:'Bearer '+token}:{}),
        ...(body?{'content-type':'application/json'}:{}),
        ...extraHeaders
      },
      ...(body?{body:JSON.stringify(body)}:{})
    });
    return {status:response.status,body:response.status===304?null:await response.json(),headers:response.headers};
  };
  try{
    await fn({request,answers,consents,calls});
  }finally{
    await new Promise(resolve=>server.close(resolve));
    for(const [p,original] of old){
      if(original)require.cache[p]=original;
      else delete require.cache[p];
    }
  }
}

test('real GET and POST HTTP routes preserve legacy JSON after simulated packed conversion',async()=>{
  await withActualRoutes(async({request,answers})=>{
    const read=token=>request('GET','/api/opinioni-list?grado=N',token);
    const save=(token,opinioni)=>request('POST','/api/opinioni/salva',token,{opinioni});
    const initial=await read('account-a');
    assert.equal(initial.status,200);
    assert.equal(initial.body.total,4);
    assert.ok(initial.body.data.every(x=>x.userAnswer===null));

    const saved=await save('account-a',{caccia:'f',nato:'c',salario_minimo:'i'});
    assert.equal(saved.status,200);
    assert.equal(saved.body.success,true);
    assert.equal(saved.body.savedCount,3);
    assert.equal(saved.body.errorCount,0);

    const after=await read('account-a');
    assert.equal(after.status,200);
    const actual=after.body.data.map(x=>({id:x.id,userAnswer:x.userAnswer}));
    assert.deepEqual(actual,[
      {id:'caccia',userAnswer:'f'},
      {id:'nato',userAnswer:'c'},
      {id:'salario_minimo',userAnswer:'i'},
      {id:'energia_nucleare',userAnswer:null}
    ]);
    for(const encoding of ['fixed','trimmed','sparse']){
      const row=answers.get('account-a');
      const envelope=encodeEnvelope(registry,{
        version:1,encoding,
        answers:Object.fromEntries(IDS.map(id=>[id,row[id]??null]))
      });
      assert.deepEqual(decodeLegacyQuestionRows(registry,envelope,IDS),actual);
    }
    assert.equal(Object.hasOwn(after.body,'catalogVersion'),false);
    assert.equal(Object.hasOwn(after.body,'payload'),false);

    const second=await read('account-b');
    assert.equal(second.status,200);
    assert.ok(second.body.data.every(x=>x.userAnswer===null));
    const saveSecond=await save('account-b',{nato:'i'});
    assert.equal(saveSecond.status,200);
    const a=await read('account-a');
    assert.equal(a.body.data[1].userAnswer,'c');
    const b=await read('account-b');
    assert.equal(b.body.data[1].userAnswer,'i');
  });
});

test('real HTTP routes deny missing/invalid auth, inactive account and missing grade',async()=>{
  await withActualRoutes(async({request,answers})=>{
    for(const token of [undefined,'invalid']){
      assert.equal((await request('GET','/api/opinioni-list?grado=N',token)).status,401);
      assert.equal((await request('POST','/api/opinioni/salva',token,
        {opinioni:{caccia:'f'}})).status,401);
    }
    assert.equal((await request('GET','/api/opinioni-list?grado=N','inactive')).status,401);
    assert.equal((await request('GET','/api/opinioni-list','account-a')).status,400);
    assert.equal(answers.size,0);
  });
});

test('real HTTP POST blocks revoked consent and invalid answers without changing stored votes',async()=>{
  await withActualRoutes(async({request,answers,consents,calls})=>{
    const post=opinioni=>request('POST','/api/opinioni/salva','account-a',{opinioni});
    assert.equal((await post({caccia:'f'})).status,200);
    const before={...answers.get('account-a')};
    consents.set('account-a',false);
    const n=calls.length;
    const rejected=await post({caccia:'c'});
    assert.equal(rejected.status,403);
    assert.equal(rejected.body.consent_required,true);
    assert.deepEqual(answers.get('account-a'),before);
    assert.equal(calls.slice(n).some(x=>x.sql.startsWith('UPDATE ')),false);
    consents.set('account-a',true);
    const bad=await post({caccia:'unsupported'});
    assert.equal(bad.status,400);
    assert.deepEqual(answers.get('account-a'),before);
  });
});


test('single-answer update preserves unrelated answers across legacy GET and all packed codecs',async()=>{
  await withActualRoutes(async({request,answers})=>{
    const post=opinioni=>request('POST','/api/opinioni/salva','account-a',{opinioni});
    assert.equal((await post({caccia:'f',nato:'c',salario_minimo:'i'})).status,200);
    const changed=await post({nato:'f'});
    assert.equal(changed.status,200);
    assert.equal(changed.body.savedCount,1);
    const after=await request('GET','/api/opinioni-list?grado=N','account-a');
    const expected=[
      {id:'caccia',userAnswer:'f'},
      {id:'nato',userAnswer:'f'},
      {id:'salario_minimo',userAnswer:'i'},
      {id:'energia_nucleare',userAnswer:null}
    ];
    assert.deepEqual(after.body.data.map(x=>({id:x.id,userAnswer:x.userAnswer})),expected);
    for(const encoding of ['fixed','trimmed','sparse']){
      const row=answers.get('account-a');
      const envelope=encodeEnvelope(registry,{
        version:1,encoding,
        answers:Object.fromEntries(IDS.map(id=>[id,row[id]??null]))
      });
      assert.deepEqual(decodeLegacyQuestionRows(registry,envelope,IDS),expected);
    }
  });
});


test('CHARACTERIZATION: revoked consent blocks writes but legacy GET still reads own stored votes',async()=>{
  await withActualRoutes(async({request,answers,consents,calls})=>{
    const post=opinioni=>request('POST','/api/opinioni/salva','account-a',{opinioni});
    const get=token=>request('GET','/api/opinioni-list?grado=N',token);
    assert.equal((await post({caccia:'f'})).status,200);
    consents.set('account-a',false);
    const beforeRead=calls.length;
    const ownRead=await get('account-a');
    assert.equal(ownRead.status,200);
    assert.equal(ownRead.body.data.find(q=>q.id==='caccia').userAnswer,'f');
    // The current GET source does not consult user_consents. This test
    // records existing behavior, NOT approval of its privacy semantics.
    const readCalls=calls.slice(beforeRead);
    assert.ok(readCalls.some(c=>c.sql.startsWith('SELECT * FROM opinioni_risposte')));
    assert.equal(readCalls.some(c=>c.sql.includes('user_consents')),false);
    const otherRead=await get('account-b');
    assert.equal(otherRead.status,200);
    assert.equal(otherRead.body.data.find(q=>q.id==='caccia').userAnswer,null);
    const denied=await post({caccia:'c'});
    assert.equal(denied.status,403);
    assert.equal(answers.get('account-a').caccia,'f');
    consents.set('account-a',true);
    assert.equal((await post({caccia:'c'})).status,200);
    assert.equal((await get('account-a')).body.data.find(q=>q.id==='caccia').userAnswer,'c');
  });
});


test('CHARACTERIZATION: conditional GET after consent revocation can return HTTP 304',async()=>{
  await withActualRoutes(async({request,consents,calls})=>{
    const url='/api/opinioni-list?grado=N';
    const saved=await request('POST','/api/opinioni/salva','account-a',
      {opinioni:{caccia:'f'}});
    assert.equal(saved.status,200);
    const first=await request('GET',url,'account-a');
    assert.equal(first.status,200);
    const etag=first.headers.get('etag');
    assert.ok(etag,'Express currently emits an ETag for personalized JSON');
    assert.equal(first.body.data.find(x=>x.id==='caccia').userAnswer,'f');
    // This documents a missing protective header; it is not a security fix.
    assert.equal(/\bno-store\b/i.test(first.headers.get('cache-control')||''),false);
    consents.set('account-a',false);
    const before=calls.length;
    const conditional=await request('GET',url,'account-a',undefined,
      {'if-none-match':etag},'force-cache');
    assert.equal(conditional.status,304);
    assert.equal(conditional.body,null);
    assert.equal(calls.slice(before).some(c=>c.sql.includes('user_consents')),false);
    // A different authenticated account must never receive account A's vote.
    const other=await request('GET',url,'account-b');
    assert.equal(other.status,200);
    assert.equal(other.body.data.find(x=>x.id==='caccia').userAnswer,null);
  });
});

test.todo('privacy policy: define no-store response headers and cache purge on consent revocation/logout');
