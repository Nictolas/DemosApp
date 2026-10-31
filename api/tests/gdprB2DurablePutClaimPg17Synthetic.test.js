'use strict';
// TEST-ONLY PostgreSQL 17 claim protocol. No production SQL, Backblaze,
// network storage, credentials, real users or restoration. Never import this
// file from an application entrypoint.
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool}=require('pg');

const URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const TABLE='gdpr_b2_put_claim_ci.claims';
const KEY1='00000000-0000-4000-8000-000000000811';
const KEY2='00000000-0000-4000-8000-000000000812';
const KEY3='00000000-0000-4000-8000-000000000813';
const KEY4='00000000-0000-4000-8000-000000000814';
const sha=message=>crypto.createHash('sha256').update(message).digest('hex');
const HASH=sha('synthetic GDPR event only');
const FUTURE='2099-01-01T00:00:00.000Z';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true' || e.GDPR_OUTBOX_WORKER_CI!=='isolated' ||
    e.TEST_DATABASE_URL!==URL || e.DATABASE_URL || e.SUPABASE_URL ||
    e.SUPABASE_DB_URL || e.SUPABASE_SERVICE_ROLE_KEY ||
    e.RENDER || e.RENDER_SERVICE_ID){
    throw Error('GDPR_B2_CLAIM_CI_REFUSES_NONLOCAL_DATABASE');
  }
}
async function claim(db,key,hash=HASH){
  const result=await db.query(
    'INSERT INTO '+TABLE+' (event_key,sha256) VALUES ($1,$2) '+
    'ON CONFLICT (event_key) DO NOTHING RETURNING event_key',[key,hash]
  );
  if(result.rowCount===1)return true;
  // An existing claim is safe to reuse only for the *same* event digest.
  // A colliding event_key with changed bytes must not be silently treated
  // as an idempotent retry. Fail closed, even after a concurrent INSERT.
  const existing=await db.query('SELECT sha256 FROM '+TABLE+
    ' WHERE event_key=$1',[key]);
  if(existing.rowCount!==1 || existing.rows[0].sha256!==hash){
    throw Error('CLAIM_EVENT_KEY_HASH_CONFLICT');
  }
  return false;
}
async function state(db,key){
  const r=await db.query('SELECT sha256,phase,version_id FROM '+TABLE+
    ' WHERE event_key=$1',[key]);
  return r.rows[0]||null;
}
// The fake provider and independent pin are two distinct, read-only injected
// test sources. They are NOT actual B2 or a durable external witness.
async function reconcile(db,key,{provider,pin}){
  const local=await state(db,key);
  if(!local || local.phase!=='UNKNOWN')throw Error('CLAIM_NOT_UNKNOWN');
  const versions=await provider.listVersions(key);
  if(!Array.isArray(versions) || versions.length!==1)
    throw Error('CLAIM_VERSION_INVENTORY_NOT_UNIQUE');
  const version=versions[0];
  const witnessed=await pin.readPin(key);
  if(!witnessed || typeof version?.versionId!=='string' ||
    version.versionId.length===0 || version.versionId.length>256 ||
    version.sha256!==local.sha256 ||
    witnessed.versionId!==version.versionId ||
    witnessed.sha256!==local.sha256 ||
    version.mode!=='COMPLIANCE' ||
    !Number.isFinite(Date.parse(version.retentionUntil)) ||
    Date.parse(version.retentionUntil)<=Date.now()){
    throw Error('CLAIM_INDEPENDENT_VERSION_PROOF_MISMATCH');
  }
  const r=await db.query(
    'UPDATE '+TABLE+' SET phase=$2,version_id=$3 '+
    'WHERE event_key=$1 AND phase=$4 AND sha256=$5 RETURNING event_key',
    [key,'VERIFIED',version.versionId,'UNKNOWN',local.sha256]
  );
  if(r.rowCount!==1)throw Error('CLAIM_CONCURRENT_RECONCILIATION');
  return {verified:true,productionRecoveryReady:false};
}
class SyntheticProvider{
  constructor(){this.versions=new Map();this.putCount=0;this.readCount=0;}
  put(key,versionId='synthetic-version-1'){
    this.putCount++;
    const old=this.versions.get(key)||[];
    old.push({versionId,sha256:HASH,mode:'COMPLIANCE',retentionUntil:FUTURE});
    this.versions.set(key,old);
  }
  async listVersions(key){
    this.readCount++;
    return (this.versions.get(key)||[]).map(x=>({...x}));
  }
}
class SyntheticPin{
  constructor(){this.pins=new Map();this.readCount=0;}
  attest(key,versionId='synthetic-version-1'){
    this.pins.set(key,{versionId,sha256:HASH});
  }
  async readPin(key){this.readCount++;return this.pins.get(key)||null;}
}

test('PG17: durable pre-PUT UNKNOWN claim blocks restart, race and unsafe replay',async t=>{
  guard();
  const db=new Pool({connectionString:URL,ssl:false,max:4});
  try{
    const identity=(await db.query(
      'SELECT current_database() AS db,current_setting(\'server_version_num\')::int AS v'
    )).rows[0];
    assert.equal(identity.db,'gdpr_outbox_worker_ci');
    assert.equal(Math.floor(identity.v/10000),17);
    await db.query('CREATE SCHEMA gdpr_b2_put_claim_ci');
    await db.query('CREATE TABLE '+TABLE+' ('+
      'event_key TEXT PRIMARY KEY,sha256 TEXT NOT NULL '+
      "CHECK (sha256 ~ '^[0-9a-f]{64}$'),"+
      "phase TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (phase IN ('UNKNOWN','VERIFIED')),"+
      'version_id TEXT,'+
      "CHECK ((phase='UNKNOWN' AND version_id IS NULL) OR "+
      "(phase='VERIFIED' AND length(version_id) BETWEEN 1 AND 256)))");
    await db.query('ALTER TABLE '+TABLE+' ENABLE ROW LEVEL SECURITY');
    await db.query('ALTER TABLE '+TABLE+' FORCE ROW LEVEL SECURITY');
    await db.query('REVOKE ALL ON '+TABLE+' FROM PUBLIC');

    await t.test('crash after committed intent but before PUT remains UNKNOWN',async()=>{
      const provider=new SyntheticProvider();
      assert.equal(await claim(db,KEY1),true);
      // New process / worker pool sees durable row; never tries PUT again.
      const restarted=new Pool({connectionString:URL,ssl:false,max:1});
      try{
        assert.deepEqual(await state(restarted,KEY1),{
          sha256:HASH,phase:'UNKNOWN',version_id:null
        });
        assert.equal(await claim(restarted,KEY1),false);
        await assert.rejects(claim(restarted,KEY1,sha('changed payload')),
          /CLAIM_EVENT_KEY_HASH_CONFLICT/);
        assert.equal(provider.putCount,0);
        await assert.rejects(reconcile(restarted,KEY1,{
          provider,pin:new SyntheticPin()
        }),/CLAIM_VERSION_INVENTORY_NOT_UNIQUE/);
        assert.equal((await state(db,KEY1)).phase,'UNKNOWN');
      }finally{await restarted.end();}
    });

    await t.test('two clients cannot acquire the same intent concurrently',async()=>{
      const c1=await db.connect(),c2=await db.connect();
      try{
        await c1.query('BEGIN');
        await c1.query('SET LOCAL statement_timeout=5000');
        assert.equal(await claim(c1,KEY2),true);
        const competing=claim(c2,KEY2);
        await sleep(30);
        await c1.query('COMMIT');
        assert.equal(await competing,false);
        await assert.rejects(claim(c2,KEY2,sha('concurrent changed event')),
          /CLAIM_EVENT_KEY_HASH_CONFLICT/);
        assert.equal((await state(db,KEY2)).phase,'UNKNOWN');
      }finally{
        try{await c1.query('ROLLBACK');}catch{}
        c1.release();c2.release();
      }
    });

    await t.test('lost PUT ACK: no retry, read-only proof requires unique version and pin',async()=>{
      const provider=new SyntheticProvider(),pin=new SyntheticPin();
      assert.equal(await claim(db,KEY3),true);
      provider.put(KEY3); // Simulates a remote commit whose ACK is lost.
      assert.equal(await claim(db,KEY3),false);
      await assert.rejects(reconcile(db,KEY3,{provider,pin}),
        /CLAIM_INDEPENDENT_VERSION_PROOF_MISMATCH/);
      pin.attest(KEY3,'wrong-version');
      await assert.rejects(reconcile(db,KEY3,{provider,pin}),
        /CLAIM_INDEPENDENT_VERSION_PROOF_MISMATCH/);
      pin.attest(KEY3);
      assert.deepEqual(await reconcile(db,KEY3,{provider,pin}),{
        verified:true,productionRecoveryReady:false
      });
      assert.equal((await state(db,KEY3)).phase,'VERIFIED');
      assert.equal(await claim(db,KEY3),false,
        'exact duplicate remains idempotent after verification');
      await assert.rejects(claim(db,KEY3,sha('mutated after verification')),
        /CLAIM_EVENT_KEY_HASH_CONFLICT/);
      assert.equal(provider.putCount,1);
      await assert.rejects(reconcile(db,KEY3,{provider,pin}),/CLAIM_NOT_UNKNOWN/);
    });

    await t.test('two COMPLIANCE versions are ambiguous even if their bytes match',async()=>{
      const provider=new SyntheticProvider(),pin=new SyntheticPin();
      assert.equal(await claim(db,KEY4),true);
      provider.put(KEY4,'synthetic-version-1');
      provider.put(KEY4,'synthetic-version-2');
      pin.attest(KEY4,'synthetic-version-1');
      await assert.rejects(reconcile(db,KEY4,{provider,pin}),
        /CLAIM_VERSION_INVENTORY_NOT_UNIQUE/);
      assert.equal((await state(db,KEY4)).phase,'UNKNOWN');
      assert.equal(provider.putCount,2);
    });

    await t.test('restored SQL missing the claim cannot prove no prior PUT',async()=>{
      // This is a NEGATIVE demonstration: the table is not independent of
      // the database. A stale snapshot may omit the committed claim.
      await db.query('DELETE FROM '+TABLE+' WHERE event_key=$1',[KEY1]);
      assert.equal(await claim(db,KEY1),true,
        'stale SQL alone could permit another claim: never grant recovery GO');
      assert.equal((await state(db,KEY1)).phase,'UNKNOWN');
    });
    console.log('GDPR_B2_DURABLE_PUT_CLAIM_PG17_SYNTHETIC_PASS');
  }finally{
    await db.query('DROP SCHEMA IF EXISTS gdpr_b2_put_claim_ci CASCADE');
    await db.end();
  }
});
