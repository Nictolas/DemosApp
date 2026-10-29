'use strict';

// Real DEMOS HTTP auth/profile middleware against isolated PostgreSQL 17 CI
// accounts. Does NOT connect to any Supabase project or third-party identity
// provider. All traffic stays on 127.0.0.1; only fabricated UUIDs are used.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');

if (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.PGHOST !== 'localhost' ||
  process.env.PGUSER !== 'postgres' ||
  process.env.PGDATABASE !== 'postgres' ||
  process.env.PGPORT !== '5432'
) throw new Error('Refusing HTTP integration outside GitHub Actions isolated PostgreSQL 17');

const mode = process.argv[2];
assert.ok(['short','long'].includes(mode), 'Expected short or long mode');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
process.env.DATABASE_POOL_MAX = '3';
process.env.DATABASE_POOL_MIN = '0';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('base64url');
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { generateAccessToken } = require('../utils/jwt');
const { verifyToken, requireAdmin, pool } = require('../middleware/auth');
const profileRouter = require('../routes/auth/profile');

const IDS = {
 elector: '00000000-0000-4000-8000-000000000002',
 institution: '00000000-0000-4000-8000-000000000004',
 adminAfterRollback: '00000000-0000-4000-8000-000000000006',
 politician: '00000000-0000-4000-8000-000000000001'
};

async function main() {
  const app = express();
  app.disable('x-powered-by');
  app.get('/whoami',verifyToken,(req,res)=>res.json({
    accountType:req.user.accountType,
    role:req.user.role,
    isAdmin:req.user.isAdmin,
    status:req.user.status
  }));
  app.get('/admin',verifyToken,requireAdmin,(req,res)=>res.json({allowed:true}));
  app.use('/auth',profileRouter);
  const server = await new Promise((resolve,reject)=>{
    const s=app.listen(0,'127.0.0.1',()=>resolve(s));
    s.on('error',reject);
  });

  async function request(route,userId,override) {
    const url='http://127.0.0.1:'+server.address().port+route;
    const headers=userId ? {Authorization:'Bearer '+(override||generateAccessToken({userId}))}:{};
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(4000)});
    const payload=await response.json();
    return {status:response.status,data:payload,headers:response.headers};
  }

  try {
    const missing=await request('/whoami');
    assert.equal(missing.status,401);
    const invalid=await request('/whoami',IDS.elector,'not-a-jwt');
    assert.equal(invalid.status,401);

    const elector=await request('/whoami',IDS.elector);
    assert.equal(elector.status,200);
    assert.equal(elector.data.accountType,'PERSON');
    assert.equal(elector.data.role,'E');
    assert.equal(elector.data.status,'a');
    assert.equal(elector.data.isAdmin,false);

    const institution=await request('/whoami',IDS.institution);
    assert.equal(institution.status,200);
    assert.equal(institution.data.accountType,'INSTITUTION');
    assert.equal(institution.data.role,'I');

    const personWithPoliticianRole=await request('/whoami',IDS.politician);
    assert.equal(personWithPoliticianRole.status,200);
    assert.equal(personWithPoliticianRole.data.accountType,'PERSON');

    // JWT claims cannot grant Admin: backend always reads the canonical DB.
    const forgedClaim=generateAccessToken({userId:IDS.elector,role:'AD',isAdmin:true});
    const denied=await request('/admin',IDS.elector,forgedClaim);
    assert.equal(denied.status,403);

    const me=await request('/auth/me',IDS.institution);
    assert.equal(me.status,200, 'Actual /auth/me canonical profile SELECT must succeed');
    assert.equal(me.data.success,true);
    assert.equal(me.data.user.account_type,'INSTITUTION');
    assert.equal(me.data.user.ruolo,'I');
    assert.equal(me.data.user.status,'a');
    assert.equal(me.data.user.regione_residenza,'Toscana',
      'Canonical user_profile override must win over nullable users column');
    assert.equal(me.data.user.rappresentante_camera,'synthetic-choice',
      'Canonical user_representatives join must provide selection');
    assert.equal(me.data.user.is_dpo,false);
    assert.equal(me.headers.get('cache-control'),'private, no-store, max-age=0');

    // Real /auth/me must display the DPO navigation role independently
    // from Admin, but this must never grant admin authorization.
    await pool.query('UPDATE public.users SET is_dpo=true WHERE id=$1',[IDS.elector]);
    try {
      const dpoProfile=await request('/auth/me',IDS.elector);
      assert.equal(dpoProfile.status,200);
      assert.equal(dpoProfile.data.user.is_dpo,true);
      assert.equal(dpoProfile.data.user.is_admin,false);
      const dpoCannotAdmin=await request('/admin',IDS.elector);
      assert.equal(dpoCannotAdmin.status,403);
    } finally {
      await pool.query('UPDATE public.users SET is_dpo=false WHERE id=$1',[IDS.elector]);
    }
    const meMissing=await request('/auth/me');
    assert.equal(meMissing.status,401);

    // Status is independent of account type: pending users are denied.
    await pool.query('UPDATE public.users SET status=$1 WHERE id=$2',['pending',IDS.elector]);
    try {
      const pending=await request('/whoami',IDS.elector);
      assert.equal(pending.status,401);
      const inactiveProfile=await request('/auth/me',IDS.elector);
      assert.equal(inactiveProfile.status,401,
        'Profile route must not reveal a revoked account on a still-valid JWT');
    } finally {
      await pool.query('UPDATE public.users SET status=$1 WHERE id=$2',['a',IDS.elector]);
    }

    // An authenticated Admin is allowed only if the database flag is true.
    if(mode==='long') {
      const allowed=await request('/admin',IDS.adminAfterRollback);
      assert.equal(allowed.status,200);
      assert.equal(allowed.data.allowed,true);
    }
    console.log('COMPACT_ACCOUNT_TYPES_REAL_HTTP_PASS',JSON.stringify({
      mode,missingTokenDenied:true,invalidTokenDenied:true,
      storageReadViaHttp:true,canonicalProfileJoin:true,dpoSeparatedFromAdmin:true,profileRoute:true,claimEscalationDenied:true,
      inactiveDenied:true,adminVerified:mode==='long'
    }));
  } finally {
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
    await pool.end();
  }
}

main().catch(err=>{console.error(err);process.exitCode=1;});
