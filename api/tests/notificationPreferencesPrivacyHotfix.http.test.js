'use strict';
// Self-contained security regression for /api/notifiche/preferenze only.
// Uses two fake JWT users and a stub pool; no credentials, DB or FCM.
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const SECRET='RAW_DATABASE_SECRET_SHOULD_NOT_LEAK';
const keys=['eurodeputato','senatore','deputato','consigliere_regionale',
 'consigliere_comunale','attivisti','demos','scuola','animali','organizzazioni'];
let injectFailure=false;
const store=new Map();
const fakePool={
 async query(sql,values=[]){
  const statement=String(sql);
  if(injectFailure)throw Object.assign(new Error(SECRET),{detail:SECRET,code:'ECONNREFUSED'});
  if(statement.includes('FROM notifiche_preferenze')){
    assert.match(statement,/WHERE user_id = \$1/);
    return {rows:store.has(values[0])?[store.get(values[0])]:[]};
  }
  if(statement.includes('INSERT INTO notifiche_preferenze')){
    const isUpdate=statement.includes('ON CONFLICT');
    const entry={user_id:values[0],updated_at:'2026-11-01T20:00:00Z'};
    for(const [i,key] of keys.entries())entry[key]=isUpdate?values[i+1]:key==='animali';
    store.set(values[0],entry);
    return {rows:[entry]};
  }
  throw new Error('UNEXPECTED_STUB_QUERY');
 }
};
const mock=(modulePath,exports)=>{
 const name=require.resolve(modulePath);
 require.cache[name]={id:name,filename:name,loaded:true,exports};
};
mock('../config/database',{getPool:()=>fakePool});
mock('../middleware/auth',{
 verifyToken:(req,res,next)=>{
  const id=req.headers.authorization==='Bearer fake-a'?A:req.headers.authorization==='Bearer fake-b'?B:null;
  if(!id)return res.status(401).json({success:false,error:'Token richiesto'});
  req.user={id,isAdmin:false};next();
 },
 requireAdmin:(req,res,next)=>res.sendStatus(403)
});
const app=express();
app.use(express.json());
app.use('/api/notifiche',require('../routes/notifiche'));
const server=app.listen(0,'127.0.0.1');
const ready=new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));
after(async()=>{if(server.listening)await new Promise(resolve=>server.close(resolve));});
async function request(user,method='GET',body){
 await ready;
 const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/notifiche/preferenze',{
  method,headers:{...(user?{'authorization':'Bearer fake-'+user}:{}),...(body?{'content-type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined
 });
 return {status:res.status,body:await res.json()};
}
test('preference HTTP errors redact raw SQL diagnostics and logs, and success logs omit user ID and selections',async()=>{
 const records=[];
 const originals={};
 for(const method of ['log','info','warn','error']){
  originals[method]=console[method];
  console[method]=(...args)=>records.push(args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));
 }
 try{
  assert.equal((await request(null)).status,401);
  assert.equal((await request(null,'POST',{preferenze:{demos:true}})).status,401);
  const a0=await request('a');
  const b0=await request('b');
  assert.equal(a0.status,200);
  assert.equal(b0.status,200);
  assert.equal(a0.body.data.user_id,A);
  assert.equal(b0.body.data.user_id,B);
  const updated=await request('a','POST',{user_id:B,preferenze:{demos:true,animali:false}});
  assert.equal(updated.status,200);
  assert.equal(updated.body.data.user_id,A,'forged user_id is ignored');
  const bAfter=await request('b');
  assert.equal(bAfter.status,200);
  assert.equal(bAfter.body.data.preferenze.demos,false);
  const aAfter=await request('a');
  assert.equal(aAfter.body.data.preferenze.demos,true);
  assert.equal(aAfter.body.data.preferenze.animali,false);
  const logs=records.join('\n');
  assert.doesNotMatch(logs,new RegExp(A+'|'+B));
  assert.doesNotMatch(logs,/demos:|animali:/);
  injectFailure=true;
  const failedRead=await request('a');
  const failedWrite=await request('a','POST',{preferenze:{demos:true}});
  assert.equal(failedRead.status,500);
  assert.equal(failedWrite.status,500);
  const returned=JSON.stringify([failedRead.body,failedWrite.body]);
  assert.doesNotMatch(returned,/RAW_DATABASE_SECRET|details|ECONNREFUSED/);
  assert.doesNotMatch(records.join('\n'),/RAW_DATABASE_SECRET|ECONNREFUSED/);
  assert.match(records.join('\n'),/NOTIF_PREFERENCES_READ_FAILED/);
  assert.match(records.join('\n'),/NOTIF_PREFERENCES_WRITE_FAILED/);
 }finally{
  injectFailure=false;
  for(const [method,fn] of Object.entries(originals))console[method]=fn;
 }
});
