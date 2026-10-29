'use strict';
// Disposable local PostgreSQL, synthetic profiles, transaction always rolled back.
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const url=process.env.DEMOS_CIE_TEST_DATABASE_URL;
process.env.IDENTITY_HMAC_SECRET='demos-ci-synthetic-only-secret-never-production-2026';
const {completeCieVerificationFromVerifiedClaims}=require('../services/cieVerificationService');
const {getIdentityVerificationStatus,registerVerifiedIdentity}=require('../services/identityVerificationStore');
const {persistVerifiedCieSex}=require('../utils/cieSex');

test('real PostgreSQL: CIE atomic write, concurrent identity and detach guards', {
  skip: !url && 'Set a disposable local DEMOS_CIE_TEST_DATABASE_URL'
},async()=>{
  const u=new URL(url);
  assert.ok(['localhost','127.0.0.1','::1'].includes(u.hostname),
    'Test refuses non-local or production PostgreSQL hosts');
  const {Client}=require('pg');
  const db=new Client({connectionString:url});
  await db.connect();
  const a=randomUUID(),b=randomUUID(),org=randomUUID();
  const fiscal='TINIT-ABCDEF12G34H567I';
  try {
    await db.query('BEGIN');
    await db.query('CREATE TEMP TABLE users(id uuid PRIMARY KEY, account_type varchar(16) NOT NULL, sesso varchar(1) CHECK (sesso IN (''M'',''F'')), updated_at timestamptz DEFAULT now()) ON COMMIT DROP'.replace(/''/g,"'"));
    await db.query('CREATE TEMP TABLE identity_verifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES users(id), person_key varchar(64) NOT NULL UNIQUE, provider varchar(32) NOT NULL, status varchar(16) NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), detached_at timestamptz, retention_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()) ON COMMIT DROP');
    await db.query('INSERT INTO users(id,account_type,sesso) VALUES($1,$4,$5),($2,$4,NULL),($3,$6,NULL)',
      [a,b,org,'PERSON','F','ORGANIZATION']);
    const first=await completeCieVerificationFromVerifiedClaims({userId:a,claims:{fiscal_number:fiscal,sesso:'M'}},db);
    assert.equal(first.created,true);
    assert.equal(first.verified,true);
    assert.equal((await db.query('SELECT sesso FROM users WHERE id=$1',[a])).rows[0].sesso,'M');
    const row=(await db.query('SELECT person_key FROM identity_verifications WHERE user_id=$1',[a])).rows[0];
    assert.match(row.person_key,/^[a-f0-9]{64}$/);
    assert.ok(!row.person_key.includes('ABCDEF12G34H567I'));
    const second=await completeCieVerificationFromVerifiedClaims({userId:a,claims:{fiscal_number:fiscal,sesso:'F'}},db);
    assert.equal(second.created,false);
    assert.equal((await db.query('SELECT sesso FROM users WHERE id=$1',[a])).rows[0].sesso,'F');
    await assert.rejects(registerVerifiedIdentity({userId:b,fiscalNumber:fiscal},db),
      e=>e?.code==='PERSON_ALREADY_LINKED');
    assert.equal((await db.query('SELECT 1 AS alive')).rows[0].alive,1);
    assert.equal((await getIdentityVerificationStatus(a,db)).verified,true);
    await db.query('UPDATE identity_verifications SET detached_at=now() WHERE user_id=$1',[a]);
    assert.deepEqual(await getIdentityVerificationStatus(a,db),{verified:false});
    await assert.rejects(persistVerifiedCieSex(db,a,'M'),/Conflitto/);
    await assert.rejects(registerVerifiedIdentity({userId:a,fiscalNumber:fiscal},db),
      e=>e?.code==='ACCOUNT_ALREADY_VERIFIED');
    await db.query('UPDATE identity_verifications SET detached_at=NULL,status=$2 WHERE user_id=$1',[a,'revoked']);
    assert.equal((await getIdentityVerificationStatus(a,db)).verified,false);
    await assert.rejects(persistVerifiedCieSex(db,a,'M'),/Conflitto/);
    await db.query('UPDATE identity_verifications SET status=$2,provider=$3 WHERE user_id=$1',[a,'verified','SPID']);
    await assert.rejects(persistVerifiedCieSex(db,a,'M'),/Conflitto/);
    await db.query('INSERT INTO identity_verifications(user_id,person_key,provider,status) VALUES($1,$2,$3,$4)',
      [org,require('../services/identityVerificationService').derivePersonKey('GHIJKL12M34N567O'),'CIE','verified']);
    await assert.rejects(persistVerifiedCieSex(db,org,'F'),/Conflitto/);
    assert.equal(await persistVerifiedCieSex(db,b,null),false);
    await db.query('ROLLBACK');
  }finally{
    try{await db.query('ROLLBACK')}catch{}
    await db.end();
  }
});
