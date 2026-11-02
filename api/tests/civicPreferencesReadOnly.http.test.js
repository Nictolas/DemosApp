'use strict';

// Synthetic HTTP contracts for the real civic notification preference routes.
// No Supabase, real identities, Firebase or push devices are accessed.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const civicKeys = ['iniziative_popolari', 'referendum_abrogativi', 'eci'];
const keys = ['eurodeputato','senatore','deputato','consigliere_regionale',
  'consigliere_comunale','attivisti','demos','scuola','animali','organizzazioni',
  ...civicKeys];
const defaults = Object.fromEntries(keys.map(key=>[key,key==='animali']));
const saved = new Map();
const statements = [];
const topicCalls = [];
let rejectRead = false;

const pool = { async query(query, values = []) {
  const sql = String(query);
  statements.push({sql,values});
  if (rejectRead) throw new Error('PRIVATE_DB_DIAGNOSTICS_SHOULD_NOT_LEAK');
  if (/^SELECT eurodeputato, senatore/.test(sql.trim())) {
    return { rows: saved.has(values[0]) ? [{...saved.get(values[0])}] : [] };
  }
  if (/^INSERT INTO notifiche_preferenze/.test(sql.trim())) {
    const old = saved.get(values[0]) ?? {};
    const updated = { ...defaults, ...old };
    for(let i=0;i<10;i++)updated[keys[i]]=values[i+1];
    for(let i=0;i<3;i++)if(values[i+11]!==null)updated[civicKeys[i]]=values[i+11];
    updated.user_id=values[0];
    updated.updated_at='2026-11-02T01:00:00.000Z';
    saved.set(values[0], updated);
    return { rows:[{ ...updated }] };
  }
  throw new Error('Unexpected test query: '+sql.slice(0,40));
} };

const moduleFiles=['../config/database','../middleware/auth',
  '../services/civicPushTopics','../services/civicPushDeliveryGuard','../routes/notifiche'];
const resolved = moduleFiles.map(path=>require.resolve(path));
const originals = resolved.map(id=>[id,require.cache[id]]);
function patch(index,exports){
  const id=resolved[index];require.cache[id]={id,filename:id,loaded:true,exports};
}
patch(0,{getPool:()=>pool});
patch(1,{
  verifyToken(req,res,next) {
    const token=req.headers.authorization;
    const id=token==='Bearer a'?A:token==='Bearer b'?B:null;
    if(!id)return res.status(401).json({success:false,error:'Unauthorized'});
    req.user={id,role:'U',isAdmin:false};next();
  },
  requireAdmin:(_req,res)=>res.sendStatus(403)
});
patch(2,{
  isCivicPushEnabled:()=>false,
  reconcileCivicTopicsForUser:async()=>{topicCalls.push('reconcile');return {enabled:false,tokens:0};},
  unsubscribeDisabledCivicTopicsForUser:async(_pool,_id,categories)=>{
    topicCalls.push('unsubscribe '+categories.join(','));return {enabled:false};
  }
});
patch(3,{
  withCivicPushDeliveryLock:async(_pool,run)=>run(pool)
});
delete require.cache[resolved[4]];
const app=express();app.use(express.json());
app.use('/api/notifiche',require('../routes/notifiche'));
let server;
async function request(method='GET',token='a',payload=null){
  if(!server){
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  }
  return new Promise((resolve,reject)=>{
    const data=payload===null?null:JSON.stringify(payload);
    const headers={ authorization:'Bearer '+token };
    if(data!==null)headers['content-type']='application/json';
    const req=http.request({host:'127.0.0.1',port:server.address().port,
      path:'/api/notifiche/preferenze',method,headers},res=>{
      const parts=[];res.on('data',p=>parts.push(p));
      res.on('end',()=>{try{const text=Buffer.concat(parts).toString('utf8');
        resolve({code:res.statusCode,headers:res.headers,text,json:JSON.parse(text)});
      }catch(err){reject(err);}});
    });
    req.on('error',reject);if(data!==null)req.write(data);req.end();
  });
}
after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const [id,entry] of originals){
    if(entry)require.cache[id]=entry;else delete require.cache[id];
  }
});

test('JWT required before accessing private preferences or SQL',async()=>{
  statements.length=0;
  const result=await request('GET','anonymous');
  assert.equal(result.code,401);
  assert.equal(statements.length,0);
});

test('first and repeated GET do one SELECT each and never write or touch FCM',async()=>{
  statements.length=0;topicCalls.length=0;saved.delete(A);
  for(let i=0;i<3;i++){
    const r=await request();
    assert.equal(r.code,200);
    assert.equal(r.headers['cache-control'],'no-store');
    assert.equal(r.json.data.user_id,A);
    assert.deepEqual(r.json.data.preferenze,defaults);
    assert.equal(r.json.data.updated_at,null);
  }
  assert.ok(statements.every(q=>q.sql.trim().startsWith('SELECT')));
  assert.equal(statements.length,3);
  assert.equal(topicCalls.length,0);
  assert.ok(!saved.has(A));
});

test('existing opt-ins are preserved and accounts remain distinct',async()=>{
  saved.set(A,{ ...defaults, iniziative_popolari:true, eci:true,
    animali:false, updated_at:'2026-10-31T00:00:00Z'});
  saved.delete(B);
  const a=await request('GET','a'), b=await request('GET','b');
  assert.equal(a.json.data.preferenze.iniziative_popolari,true);
  assert.equal(a.json.data.preferenze.eci,true);
  assert.equal(a.json.data.preferenze.animali,false);
  assert.equal(b.json.data.preferenze.iniziative_popolari,false);
  assert.equal(b.json.data.preferenze.eci,false);
  assert.equal(b.json.data.preferenze.animali,true);
  assert.equal(b.json.data.updated_at,null);
});

test('NULL values fall back only to their privacy-safe defaults',async()=>{
  saved.set(A,{...defaults,eci:null,referendum_abrogativi:null,
    iniziative_popolari:null,animali:null,updated_at:null});
  const a=await request();
  assert.equal(a.json.data.preferenze.eci,false);
  assert.equal(a.json.data.preferenze.referendum_abrogativi,false);
  assert.equal(a.json.data.preferenze.iniziative_popolari,false);
  assert.equal(a.json.data.preferenze.animali,true);
});

test('explicit POST remains authoritative; GET then reads actual civic consent',async()=>{
  topicCalls.length=0;statements.length=0;
  const posted=await request('POST','a',{preferenze:{eci:true,animali:false}});
  assert.equal(posted.code,200);
  assert.equal(posted.json.data.preferenze.eci,true);
  const loaded=await request();
  assert.equal(loaded.code,200);
  assert.equal(loaded.json.data.preferenze.eci,true);
  assert.equal(loaded.json.data.preferenze.animali,false);
  assert.equal(statements.filter(x=>/^INSERT/.test(x.sql.trim())).length,1);
});

test('legacy client POST without civic keys cannot reset saved civic opt-ins',async()=>{
  saved.set(B,{...defaults,eci:true,referendum_abrogativi:true,updated_at:'2026-11-01'});
  const result=await request('POST','b',{preferenze:{demos:true}});
  assert.equal(result.code,200);
  const after=await request('GET','b');
  assert.equal(after.json.data.preferenze.eci,true);
  assert.equal(after.json.data.preferenze.referendum_abrogativi,true);
});

test('invalid civic consent rejected before SQL or FCM',async()=>{
  statements.length=0;topicCalls.length=0;
  const result=await request('POST','a',{preferenze:{eci:'yes please'}});
  assert.equal(result.code,400);
  assert.equal(statements.length,0);
  assert.equal(topicCalls.length,0);
});

test('DB diagnostics never escape through HTTP and do not reveal stored values',async()=>{
  rejectRead=true;
  const r=await request();
  rejectRead=false;
  assert.equal(r.code,500);
  assert.equal(r.json.error,'Errore interno del server');
  assert.doesNotMatch(r.text,/PRIVATE_DB_DIAGNOSTICS_SHOULD_NOT_LEAK|SELECT eurodeputato/);
});

test('GET source cannot contain SQL mutations or topic subscriptions',()=>{
  const fs=require('node:fs');const path=require('node:path');
  const source=fs.readFileSync(path.resolve(__dirname,'../routes/notifiche.js'),'utf8');
  const a=source.indexOf('// GET /api/notifiche/preferenze');
  const b=source.indexOf('// POST /api/notifiche/preferenze',a);
  assert.ok(a>0&&b>a);
  const get=source.slice(a,b);
  assert.doesNotMatch(get,/\bINSERT INTO\b|\bUPDATE notifiche_preferenze\b|\bDELETE FROM\b|reconcileCivicTopicsForUser\(/);
  assert.match(get,/eci: false/);
  assert.match(get,/\[user_id\]/);
});
