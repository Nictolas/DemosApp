'use strict';

// Synthetic HTTP test of all four authenticated device mutations.
// No real PostgreSQL, Firebase, Render, Supabase, production or user data.
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const express=require('express');

const TOKEN='fcm_synthetic_'+'a'.repeat(150);
const FOREIGN='fcm_synthetic_'+'b'.repeat(150);
let legacyFixture=[TOKEN];
let legacyColumnPresent=true;
let foreignFixture=false;
let activeCanonicalFixture=[];
const unsubscribeCalls=[];
const upserts=[];
const USER='11111111-1111-4111-8111-111111111111';
let gate=null,locked=false,server=null;
const calls=[];
function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}

const modules=[
  '../config/database','../middleware/auth','../services/civicPushTopics',
  '../services/civicPushDeliveryGuard','../services/civicPreferenceAtomicSave',
  '../services/civicFcmTokenOwnership','../routes/fcm-tokens'
].map(p=>require.resolve(p));
const originals=modules.map(id=>[id,require.cache[id]]);
function patch(i,exports){
  const id=modules[i];require.cache[id]={id,filename:id,loaded:true,exports};
}
const db={
  async query(sql,params){
    const text=String(sql);
    calls.push('SQL');
    if(text.includes('INSERT INTO user_devices')) upserts.push(params);
    if(text.includes('FROM users AS u WHERE u.id = $1')){
      return {rows:[{fcm_tokens:legacyFixture,legacy_column_present:legacyColumnPresent}]};
    }
    if(text.includes('SELECT 1 FROM user_devices')){
      return {rows:[{exists:1}]};
    }
    if(text.includes('FROM user_devices'))return {rows:[]};
    return {rows:[],rowCount:1};
  }
};
const pool={query:db.query.bind(db)};
patch(0,{getPool:()=>pool});
patch(1,{
  verifyToken(req,res,next){
    if(req.headers.authorization!=='Bearer synthetic'){
      return res.status(401).json({success:false,error:'Unauthorized'});
    }
    req.user={id:USER,isAdmin:false};next();
  }
});
patch(2,{
  isCivicPushEnabled:()=>true,
  reconcileCivicTopicsForUser:async()=>({enabled:true,tokens:1}),
  unsubscribeCivicTopicsForToken:async(token)=>{unsubscribeCalls.push(token);return {enabled:true};},
});
patch(3,{
  withCivicPushDeliveryLock:async(_pool,work)=>{
    assert.equal(_pool,pool);
    locked=true;calls.push('LOCK');
    try {return await work(db);}
    finally {locked=false;calls.push('UNLOCK');}
  },
  blockCivicDeliveryFromPool:async(_pool)=>{
    assert.equal(_pool,pool);
    assert.equal(locked,false,'guard recovery must run after unlocking');
    calls.push('GUARD_BLOCKED');
  },
  blockCivicDeliveryOnRevocationFailure:async()=>{throw Error('UNEXPECTED_LOCKED_GUARD');},
});
patch(4,{
  runCivicPreferenceSaveAtomic:async(_db,work,opts)=>{
    assert.equal(_db,db);
    assert.equal(opts.enabled,true);
    calls.push('BEGIN');
    const value=await work();
    calls.push('WORK_COMPLETE');
    if(gate){
      gate.workDone.resolve();
      await gate.confirm.promise;
      calls.push('COMMIT_UNCONFIRMED');
      throw Error('SIMULATED_COMMIT_ACK_LOST');
    }
    calls.push('COMMIT_CONFIRMED');
    return value;
  }
});
patch(5,{
  onlyTokensNotOwnedByOthers:async(_db,_user,tokens)=>[...new Set(tokens)],
  onlyTokensNotRegisteredToOthers:async(_db,_user,tokens)=>
    tokens.filter(token=>!(foreignFixture && token===FOREIGN)),
  getActiveCivicUserDeviceTokens:async()=>[...activeCanonicalFixture],
  upsertCleanupOwnedOrUnassignedToken:async(_db,userId,token)=>{
    calls.push('PROTECTED_CLEANUP_UPSERT');
    upserts.push([userId,token]);
  },
});
delete require.cache[modules[6]];
const app=express();app.use(express.json());
app.use('/api/fcm-tokens',require('../routes/fcm-tokens'));

async function request(method,path,payload,auth=true){
  if(!server){
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  }
  return new Promise((resolve,reject)=>{
    // Native DELETE requests have no JSON body. Sending Content-Type with
    // an empty DELETE body triggers Express json-parser's 400 before auth.
    const isPost=method==='POST';
    const body=isPost?JSON.stringify(payload??{}):null;
    const headers={'user-agent':'Android Mobile'};
    if(isPost)headers['content-type']='application/json';
    if(auth)headers.authorization='Bearer synthetic';
    const req=http.request({hostname:'127.0.0.1',port:server.address().port,
      path,method,headers},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>{
        const raw=Buffer.concat(chunks).toString('utf8');
        try{resolve({status:res.statusCode,body:JSON.parse(raw),raw});}
        catch{
          // Never emit the synthetic FCM token in CI diagnostic output.
          const endpoint=path.includes('cleanup')?'cleanup':
            path.endsWith('/session')?'logout':
            method==='DELETE'?'single-delete':'register';
          reject(new Error('SYNTHETIC_HTTP_INVALID_JSON_'+endpoint+
            '_STATUS_'+res.statusCode+'_LENGTH_'+raw.length+
            '_TYPE_'+String(res.headers['content-type']||'missing')));
        }
      });
    });
    req.on('error',reject);
    if(body===null)req.end();
    else req.end(body);
  });
}
after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const [id,prior] of originals){
    if(prior)require.cache[id]=prior;
    else delete require.cache[id];
  }
});

test('all four routes withhold HTTP success when SQL commit is uncertain',async()=>{
  const cases=[
    ['POST','/api/fcm-tokens',{token:TOKEN}],
    ['POST','/api/fcm-tokens/cleanup',{}],
    ['DELETE','/api/fcm-tokens/session',{}],
    ['DELETE','/api/fcm-tokens/'+TOKEN,{}],
  ];
  for(const [method,path,payload] of cases){
    calls.length=0;
    gate={workDone:deferred(),confirm:deferred()};
    let replied=false;
    const pending=request(method,path,payload).then(value=>{replied=true;return value;});
    try{
      await gate.workDone.promise;
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(replied,false,method+' '+path+' responded before commit');
      assert.equal(locked,true);
      gate.confirm.resolve();
      const response=await pending;
      assert.ok(response.status>=500,method+' '+path+' falsely succeeded');
      assert.equal(response.body.success,false);
      assert.doesNotMatch(response.raw,/SIMULATED_|11111111|fcm_synthetic_/);
      assert.ok(calls.indexOf('COMMIT_UNCONFIRMED')<
        calls.indexOf('UNLOCK'));
      assert.ok(calls.indexOf('UNLOCK')<calls.indexOf('GUARD_BLOCKED'));
    }finally{
      gate.confirm.resolve();
      gate=null;
    }
  }
});

test('success is returned only after the transaction completed',async()=>{
  gate=null;calls.length=0;
  const reg=await request('POST','/api/fcm-tokens',{token:TOKEN});
  assert.equal(reg.status,200);
  assert.equal(reg.body.success,true);
  assert.ok(calls.indexOf('COMMIT_CONFIRMED')<calls.indexOf('UNLOCK'));
  assert.equal(calls.includes('GUARD_BLOCKED'),false);
});

test('anonymous token mutation never acquires lock or touches the database',async()=>{
  gate=null;calls.length=0;
  const resp=await request('DELETE','/api/fcm-tokens/session',{},false);
  assert.equal(resp.status,401);
  assert.deepEqual(calls,[]);
});

test('legacy cleanup cannot steal a newly reassigned foreign token',async()=>{
  gate=null;calls.length=0;upserts.length=0;
  legacyFixture=[TOKEN,FOREIGN];foreignFixture=true;
  try{
    const response=await request('POST','/api/fcm-tokens/cleanup',{});
    assert.equal(response.status,200);
    assert.equal(response.body.success,true);
    assert.equal(response.body.data.tokenCountBefore,2);
    assert.equal(response.body.data.tokenCountAfter,1);
    assert.deepEqual(upserts,[[USER,TOKEN]],
      'only the surviving original-account token may be reactivated');
  } finally {
    legacyFixture=[TOKEN];foreignFixture=false;
  }
});

test('cleanup clears foreign-only stale legacy without reassigning it',async()=>{
  gate=null;calls.length=0;upserts.length=0;
  legacyFixture=[FOREIGN];foreignFixture=true;
  try {
    const result=await request('POST','/api/fcm-tokens/cleanup',{});
    assert.equal(result.status,200);
    assert.equal(result.body.data.tokenCountAfter,0);
    assert.deepEqual(upserts,[],'foreign account device must remain untouched');
  } finally {
    legacyFixture=[TOKEN];foreignFixture=false;
  }
});

test('registration succeeds on canonical device when legacy field is absent',async()=>{
  gate=null;calls.length=0;upserts.length=0;
  legacyFixture=[];legacyColumnPresent=false;
  try{
    const res=await request('POST','/api/fcm-tokens',{token:TOKEN});
    assert.equal(res.status,200);
    assert.equal(res.body.success,true);
    assert.equal(upserts.length,1);
    assert.ok(calls.includes('COMMIT_CONFIRMED'));
  }finally{legacyFixture=[TOKEN];legacyColumnPresent=true;}
});

test('cleanup with retired legacy field leaves canonical device records untouched',async()=>{
  gate=null;calls.length=0;upserts.length=0;
  legacyFixture=[];legacyColumnPresent=false;
  try{
    const res=await request('POST','/api/fcm-tokens/cleanup',{});
    assert.equal(res.status,200);
    assert.equal(res.body.data.skipped,true);
    assert.deepEqual(upserts,[]);
    assert.equal(calls.includes('PROTECTED_CLEANUP_UPSERT'),false);
  }finally{legacyFixture=[TOKEN];legacyColumnPresent=true;}
});

test('empty legacy array preserves current active canonical token',async()=>{
  gate=null;calls.length=0;upserts.length=0;unsubscribeCalls.length=0;
  legacyColumnPresent=true;legacyFixture=[];
  activeCanonicalFixture=[TOKEN];
  try {
    const res=await request('POST','/api/fcm-tokens/cleanup',{});
    assert.equal(res.status,200);
    assert.equal(res.body.success,true);
    assert.deepEqual(upserts,[[USER,TOKEN]],
      'cleanup must reactivate the existing authoritative device');
    assert.equal(res.body.data.tokenCountBefore,0);
    assert.equal(res.body.data.tokenCountAfter,1);
    assert.equal(res.body.data.removedCount,0,
      'adding the canonical survivor is not negative legacy removal');
    assert.deepEqual(unsubscribeCalls,[],
      'surviving active device must not be unsubscribed');
  }finally {
    legacyFixture=[TOKEN];activeCanonicalFixture=[];
  }
});

test('stale foreign legacy cannot replace current canonical token or revoke foreign one',async()=>{
  gate=null;calls.length=0;upserts.length=0;unsubscribeCalls.length=0;
  legacyColumnPresent=true;legacyFixture=[FOREIGN];
  activeCanonicalFixture=[TOKEN];foreignFixture=true;
  try{
    const res=await request('POST','/api/fcm-tokens/cleanup',{});
    assert.equal(res.status,200);
    assert.equal(res.body.data.tokenCountBefore,1);
    assert.equal(res.body.data.tokenCountAfter,1);
    assert.equal(res.body.data.removedCount,1);
    assert.deepEqual(upserts,[[USER,TOKEN]]);
    assert.deepEqual(unsubscribeCalls,[],
      'foreign inactive/active device must never be unsubscribed');
  }finally {
    foreignFixture=false;legacyFixture=[TOKEN];activeCanonicalFixture=[];
  }
});

test('two canonical active devices retain the newest and revoke only the stale device',async()=>{
  gate=null;calls.length=0;upserts.length=0;unsubscribeCalls.length=0;
  legacyColumnPresent=true;legacyFixture=[];
  activeCanonicalFixture=[TOKEN,FOREIGN];
  try{
    const res=await request('POST','/api/fcm-tokens/cleanup',{});
    assert.equal(res.status,200);
    assert.deepEqual(upserts,[[USER,TOKEN]]);
    assert.deepEqual(unsubscribeCalls,[FOREIGN]);
    assert.equal(res.body.data.removedCount,0);
  }finally {
    legacyFixture=[TOKEN];activeCanonicalFixture=[];
  }
});
