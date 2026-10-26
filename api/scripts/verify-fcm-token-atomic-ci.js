'use strict';

/** Synthetic-only PostgreSQL 17 + HTTP FCM transactional rollback/race drill.
 * No real accounts, provider, credentials or Firebase delivery. */
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const express = require('express');
const http = require('node:http');
const { invalidateFailedFcmTokens } = require('../services/fcmTokenInvalidationService');
const DB = 'political_consent_race_ci';
const USER = '00000000-0000-4000-8000-000000000611';
const OTHER = '00000000-0000-4000-8000-000000000612';
const OLD = 'O'.repeat(125);
const NEW = 'N'.repeat(125);
const LAST = 'L'.repeat(125);
const routePath = require.resolve('../routes/fcm-tokens.js');
const dbConfigPath = require.resolve('../config/database.js');
const authPath = require.resolve('../middleware/auth.js');
const gate = () => {
  let resolve;
  return { promise: new Promise(done => {resolve=done;}), resume:() => resolve() };
};
function guard() {
  const expected = {
    GITHUB_ACTIONS:'true', POLITICAL_CONSENT_RACE_CI:'synthetic',
    PGHOST:'127.0.0.1', PGPORT:'5432', PGDATABASE:DB,
    PGUSER:'postgres', PGPASSWORD:'synthetic-only'
  };
  for(const [key,value] of Object.entries(expected)) {
    if(process.env[key]!==value) throw Error('Refusing non-synthetic DB: '+key);
  }
  for(const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL',
    'SUPABASE_SERVICE_ROLE_KEY','RENDER']) {
    if(process.env[key]) throw Error('Refusing provider environment: '+key);
  }
}
const compact = sql => String(sql).replace(/\s+/g,' ').trim();
function timeout(p,ms=9000) {
  return Promise.race([p,new Promise((_,reject)=>
    setTimeout(()=>reject(Error('Synthetic FCM lock wait timeout')),ms))]);
}
async function main() {
  guard();
  const real = new Pool({
    host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:6,connectionTimeoutMillis:3500,
    statement_timeout:8000,application_name:'synthetic_fcm_atomic'
  });
  const cached = new Map([routePath,dbConfigPath,authPath]
    .map(p=>[p,require.cache[p]]));
  let server, failSql=null, lockHold=null;
  const pool = {
    query:(...args)=>real.query(...args),
    async connect() {
      const client=await real.connect();
      return {
        async query(sql,params) {
          const q=compact(sql);
          if(lockHold && q==='SELECT id FROM public.users WHERE id = $1 FOR UPDATE') {
            lockHold.attempts++;
            if(lockHold.attempts===2) lockHold.secondAttempt.resume();
          }
          if(failSql && q.includes(failSql))
            throw Object.assign(Error('Synthetic forced DB error'),{code:'23514'});
          const result=await client.query(sql,params);
          if(lockHold && q==='SELECT id FROM public.users WHERE id = $1 FOR UPDATE' &&
              !lockHold.paused) {
            lockHold.paused=true;
            lockHold.firstAcquired.resume();
            await timeout(lockHold.unblock.promise);
          }
          return result;
        },
        release:()=>client.release()
      };
    }
  };
  const request = (base,route,method='POST',token=null,userId=USER) => fetch(base+route,{
    method,headers:{
      'content-type':'application/json','user-agent':'Synthetic Android Mobile',
      'x-synthetic-user':userId
    },
    ...(token===null?{}:{body:JSON.stringify({token})}),
    signal:AbortSignal.timeout(12000)
  });
  const state=async(id=USER)=>({
    legacy:(await real.query(
      'SELECT fcm_tokens FROM public.users WHERE id=$1',[id]
    )).rows[0]?.fcm_tokens||[],
    devices:(await real.query(
      'SELECT user_id::text AS owner,fcm_token AS token,is_active AS active '+
      'FROM public.user_devices WHERE user_id=$1 ORDER BY fcm_token',[id]
    )).rows
  });
  try {
    const meta=(await real.query(
      "SELECT current_database() db,current_setting('server_version_num')::int v"
    )).rows[0];
    assert.equal(meta.db,DB);
    assert.equal(Math.floor(meta.v/10000),17);
    // This database is created by GitHub Actions from scratch. Add only
    // made-up fixture identities and a disposable canonical device registry.
    await real.query(
      'CREATE TABLE IF NOT EXISTS public.users (' +
      'id uuid PRIMARY KEY,political_opinions_consent boolean NOT NULL, '+
      'updated_at timestamptz DEFAULT NOW())'
    );
    await real.query(
      'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fcm_tokens text[] '+
      'DEFAULT ARRAY[]::text[]'
    );
    await real.query(
      'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW()'
    );
    await real.query(
      'CREATE TABLE IF NOT EXISTS public.user_devices ('+
      'id bigserial PRIMARY KEY,user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,'+
      'fcm_token text NOT NULL UNIQUE,is_active boolean NOT NULL DEFAULT TRUE,'+
      'last_seen_at timestamptz DEFAULT NOW(),created_at timestamptz DEFAULT NOW(),'+
      'updated_at timestamptz DEFAULT NOW())'
    );
    await real.query('DELETE FROM public.user_devices WHERE user_id = ANY($1::uuid[])',[[USER,OTHER]]);
    await real.query(
      'INSERT INTO public.users(id,political_opinions_consent,fcm_tokens) '+
      'VALUES ($1,true,ARRAY[]::text[]),($2,true,ARRAY[]::text[]) '+
      'ON CONFLICT(id) DO UPDATE SET fcm_tokens=EXCLUDED.fcm_tokens',
      [USER,OTHER]
    );
    require.cache[dbConfigPath]={id:dbConfigPath,filename:dbConfigPath,
      loaded:true,exports:{getPool:()=>pool}};
    require.cache[authPath]={id:authPath,filename:authPath,
      loaded:true,exports:{verifyToken:(req,_res,next)=>{
        const user=req.get('x-synthetic-user');
        req.user={id:user===OTHER?OTHER:USER};
        next();
      }}};
    delete require.cache[routePath];
    const router=require(routePath);
    const app=express();
    app.use(express.json());
    app.use('/api/fcm-tokens',router);
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;

    assert.equal((await request(base,'/api/fcm-tokens','POST',OLD)).status,200);
    let before=await state();
    assert.deepEqual(before.legacy,[OLD]);
    assert.deepEqual(before.devices.map(d=>[d.token,d.active]),[[OLD,true]]);

    for(const [route,method,token,failure] of [
      ['/api/fcm-tokens','POST',NEW,'INSERT INTO public.user_devices'],
      ['/api/fcm-tokens/cleanup','POST',null,'UPDATE public.user_devices SET is_active'],
      ['/api/fcm-tokens/'+OLD,'DELETE',null,'AND btrim(fcm_token) = $2']
    ]) {
      failSql=failure;
      const response=await request(base,route,method,token);
      failSql=null;
      assert.equal(response.status,500,'mid-transaction error must fail HTTP');
      assert.deepEqual(await state(),before,'every failed FCM operation must rollback BOTH storages');
    }
    console.log('FCM_ATOMIC_ROLLBACK_PG17_PASS');

    // The first writer pauses after it acquired the canonical user row
    // lock; a competing DELETE reaches the same lock but cannot complete.
    const hold={firstAcquired:gate(),secondAttempt:gate(),unblock:gate(),attempts:0,paused:false};
    lockHold=hold;
    const register=request(base,'/api/fcm-tokens','POST',NEW);
    await timeout(hold.firstAcquired.promise);
    const revoke=request(base,'/api/fcm-tokens/'+NEW,'DELETE');
    try {
      await timeout(hold.secondAttempt.promise);
      const current=await state();
      assert.deepEqual(current,before,
        'no uncommitted FCM mutations may be visible outside first transaction');
    } finally {
      hold.unblock.resume();
    }
    const first=await timeout(register);
    const second=await timeout(revoke);
    lockHold=null;
    assert.equal(first.status,200);
    assert.equal(second.status,200);
    const after=await state();
    assert.deepEqual(after.legacy,[]);
    assert.equal(after.devices.find(d=>d.token===NEW)?.active,false);
    assert.equal(after.devices.find(d=>d.token===OLD)?.active,false);
    console.log('FCM_ATOMIC_CONCURRENT_REGISTER_REVOKE_PG17_PASS');

    // A token transferred to another account cannot be disabled by a late
    // DELETE from the previous account.
    assert.equal((await request(base,'/api/fcm-tokens','POST',LAST,USER)).status,200);
    assert.equal((await request(base,'/api/fcm-tokens','POST',LAST,OTHER)).status,200);
    assert.equal((await request(base,'/api/fcm-tokens/'+LAST,'DELETE',null,USER)).status,200);
    assert.equal((await state(OTHER)).devices.find(d=>d.token===LAST)?.active,true);
    console.log('FCM_ATOMIC_TRANSFER_OWNER_PG17_PASS');

    // PostgreSQL error 42703 normally makes COMMIT impossible. Both
    // getLegacyTokens/updateLegacyTokens must restore a savepoint first.
    await real.query('ALTER TABLE public.users DROP COLUMN fcm_tokens');
    assert.equal((await request(base,'/api/fcm-tokens','POST',NEW,USER)).status,200,
      'missing legacy column must not poison canonical upsert transaction');
    const canonical=(await real.query(
      'SELECT fcm_token,is_active FROM public.user_devices WHERE user_id=$1 '+
      'AND fcm_token=$2',[USER,NEW]
    )).rows;
    assert.deepEqual(canonical,[{fcm_token:NEW,is_active:true}]);
    console.log('FCM_ATOMIC_OPTIONAL_LEGACY_SAVEPOINT_PG17_PASS');

    // No legacy column: shared invalidation must first deactivate the
    // canonical record and recover its optional 42703 via a savepoint.
    const missingLegacy = await invalidateFailedFcmTokens(pool,{
      userId:USER,tokens:[' '+NEW+' ',NEW]
    });
    assert.equal(missingLegacy.invalidated,1);
    assert.equal(missingLegacy.legacyRemoved,0);
    assert.equal((await real.query(
      'SELECT is_active FROM public.user_devices WHERE user_id=$1 AND fcm_token=$2',
      [USER,NEW]
    )).rows[0]?.is_active,false);
    console.log('FCM_SHARED_INVALIDATION_MISSING_LEGACY_PG17_PASS');

    // Re-add only to this disposable GitHub CI DB, then test rollback of
    // the canonical UPDATE if a subsequent legacy write fails.
    await real.query(
      'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fcm_tokens text[] '+
      'DEFAULT ARRAY[]::text[]'
    );
    await real.query('UPDATE public.users SET fcm_tokens=$1 WHERE id=$2',[[NEW],USER]);
    await real.query(
      'UPDATE public.user_devices SET is_active=TRUE WHERE user_id=$1 AND fcm_token=$2',
      [USER,NEW]
    );
    const beforeInvalidation=await state(USER);
    failSql='UPDATE public.users SET fcm_tokens =';
    try {
      await assert.rejects(
        invalidateFailedFcmTokens(pool,{userId:USER,tokens:[NEW]}),
        e=>e?.code==='23514',
        'synthetic legacy SQL error must abort entire shared invalidation'
      );
    } finally { failSql=null; }
    assert.deepEqual(await state(USER),beforeInvalidation,
      'canonical deactivation must rollback when legacy write fails');
    console.log('FCM_SHARED_INVALIDATION_ROLLBACK_PG17_PASS');

    // Successful invalidation must deactivate, not DELETE, the canonical
    // row, and atomically remove normalized variants from the legacy array.
    await real.query('UPDATE public.users SET fcm_tokens=$1 WHERE id=$2',
      [[' '+NEW+' ',OLD],USER]);
    const result=await invalidateFailedFcmTokens(pool,{
      userId:USER,tokens:[' '+NEW+' ',NEW]
    });
    assert.equal(result.invalidated,1);
    assert.equal(result.legacyRemoved,1);
    assert.equal((await state(USER)).devices.find(d=>d.token===NEW)?.active,false);
    assert.deepEqual((await state(USER)).legacy,[OLD]);
    console.log('FCM_SHARED_INVALIDATION_CANONICAL_PG17_PASS');

    // A stale Firebase failure from the former owner must never mutate
    // another account's current canonical device registration.
    const crossUser=await invalidateFailedFcmTokens(pool,{
      userId:USER,tokens:[LAST]
    });
    assert.equal(crossUser.invalidated,0);
    assert.equal((await state(OTHER)).devices.find(d=>d.token===LAST)?.active,true);
    console.log('FCM_SHARED_INVALIDATION_TRANSFER_PG17_PASS');
  } finally {
    if(lockHold) lockHold.unblock.resume();
    failSql=null;
    if(server) await new Promise(resolve=>server.close(resolve));
    for(const [name,original] of cached) {
      if(original) require.cache[name]=original; else delete require.cache[name];
    }
    try {
      // Only our disposable CI database: leave the common fixture ready
      // for further tests, even if the missing-column proof fails.
      await real.query('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fcm_tokens text[] '+
        'DEFAULT ARRAY[]::text[]');
      await real.query('DELETE FROM public.user_devices WHERE user_id=ANY($1::uuid[])',[[USER,OTHER]]);
      await real.query('DELETE FROM public.users WHERE id=ANY($1::uuid[])',[[USER,OTHER]]);
    } finally {
      await real.end();
    }
  }
}
main().catch(error=>{
  console.error('FCM_ATOMIC_PG17_FAIL:',error?.code || error?.message || 'unexpected');
  process.exitCode=1;
});
