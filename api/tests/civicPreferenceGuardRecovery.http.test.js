'use strict';

// Route-level synthetic HTTP regression: never accesses Supabase, Render,
// Firebase, real accounts or user devices.
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const express=require('express');

let enabled=true,failRecovery=false,failLock=false,locked=false;
const history=[];
const pool={query:async()=>{throw Error('NO_REAL_DATABASE_IN_HTTP_FIXTURE');}};

const modules=[
  '../config/database',
  '../middleware/auth',
  '../services/civicPushTopics',
  '../services/civicPushDeliveryGuard',
  '../services/civicPreferenceAtomicSave',
  '../routes/notifiche',
].map(x=>require.resolve(x));
const originals=modules.map(id=>[id,require.cache[id]]);
function patch(i,exports){
  const id=modules[i];
  require.cache[id]={id,filename:id,loaded:true,exports};
}
patch(0,{getPool:()=>pool});
patch(1,{
  verifyToken:(req,res,next)=>{
    if(req.headers.authorization!=='Bearer synthetic'){
      return res.status(401).json({success:false,error:'Unauthorized'});
    }
    req.user={id:'11111111-1111-4111-8111-111111111111',isAdmin:false};
    next();
  },
  requireAdmin:(_req,res)=>res.sendStatus(403),
});
patch(2,{
  isCivicPushEnabled:()=>enabled,
  reconcileCivicTopicsForUser:async()=>{throw Error('UNEXPECTED_FCM_RECONCILIATION');},
  unsubscribeDisabledCivicTopicsForUser:async()=>{throw Error('UNEXPECTED_UNSUBSCRIBE');},
});
patch(3,{
  withCivicPushDeliveryLock:async(_pool,callback)=>{
    assert.equal(_pool,pool);
    locked=true;history.push('LOCK');
    try {
      if(failLock)throw Error('PRIVATE_SESSION_LOCK_UNAVAILABLE');
      return await callback({query:async()=>{throw Error('NO_REAL_SQL');}});
    }finally{
      locked=false;history.push('UNLOCK');
    }
  },
  blockCivicDeliveryFromPool:async(_pool)=>{
    assert.equal(_pool,pool);
    assert.equal(locked,false,'retry only after initial lock released');
    history.push('EMERGENCY_STOP_RETRY');
    if(failRecovery)throw Error('PRIVATE_SECOND_DB_CONNECTION_FAILURE');
  },
});
patch(4,{
  runCivicPreferenceSaveAtomic:async()=>{
    history.push('TRANSACTION_UNCONFIRMED');
    throw Error('PRIVATE_FIREBASE_OR_ROLLBACK_UNCERTAIN');
  },
});
delete require.cache[modules[5]];
const app=express();
app.use(express.json());
app.use('/api/notifiche',require('../routes/notifiche'));
let server;
async function request(auth=true) {
  if(!server){
    server=http.createServer(app);
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
  }
  return new Promise((resolve,reject)=>{
    const payload=JSON.stringify({preferenze:{eci:false}});
    const headers={'content-type':'application/json'};
    if(auth)headers.authorization='Bearer synthetic';
    const req=http.request({hostname:'127.0.0.1',port:server.address().port,
      path:'/api/notifiche/preferenze',method:'POST',headers},res=>{
      const chunks=[];
      res.on('data',c=>chunks.push(c));
      res.on('end',()=>{
        const raw=Buffer.concat(chunks).toString('utf8');
        try {resolve({status:res.statusCode,body:JSON.parse(raw),raw});}
        catch(e){reject(e);}
      });
    });
    req.on('error',reject);
    req.end(payload);
  });
}
after(async()=>{
  if(server)await new Promise(done=>server.close(done));
  for(const [id,prior] of originals){
    if(prior)require.cache[id]=prior;else delete require.cache[id];
  }
});

test('push ON failed consent save retries emergency stop only after unlock',async()=>{
  history.length=0;enabled=true;failRecovery=false;failLock=false;
  const r=await request();
  assert.equal(r.status,503);
  assert.equal(r.body.success,false);
  assert.deepEqual(history,['LOCK','TRANSACTION_UNCONFIRMED','UNLOCK','EMERGENCY_STOP_RETRY']);
  assert.doesNotMatch(r.raw,/PRIVATE_|11111111|fcm_token|NO_REAL_SQL/);
});

test('failed initial lock also attempts a separate protective stop',async()=>{
  history.length=0;enabled=true;failRecovery=false;failLock=true;
  const r=await request();
  assert.equal(r.status,503);
  assert.deepEqual(history,['LOCK','UNLOCK','EMERGENCY_STOP_RETRY']);
});

test('second-connection outage never converts a failed consent into success',async()=>{
  history.length=0;enabled=true;failRecovery=true;failLock=false;
  const r=await request();
  assert.equal(r.status,503);
  assert.equal(r.body.success,false);
  assert.deepEqual(history,['LOCK','TRANSACTION_UNCONFIRMED','UNLOCK','EMERGENCY_STOP_RETRY']);
  assert.doesNotMatch(r.raw,/PRIVATE_|SECOND_DB_CONNECTION|11111111|fcm_token/);
});

test('push disabled does not add emergency-stop queries even on error',async()=>{
  history.length=0;enabled=false;failRecovery=false;failLock=false;
  const r=await request();
  assert.equal(r.status,503);
  assert.deepEqual(history,['LOCK','TRANSACTION_UNCONFIRMED','UNLOCK']);
});

test('anonymous POST cannot enter any preference mutation or guard call',async()=>{
  history.length=0;
  const r=await request(false);
  assert.equal(r.status,401);
  assert.deepEqual(history,[]);
});
