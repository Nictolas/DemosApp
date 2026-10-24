const test = require('node:test');
const assert = require('node:assert/strict');
const { derivePersonKey } = require('../services/identityVerificationService');
const {
  TTL_SECONDS, assertSameVerifiedPerson, savePublicNameProof,
  peekPublicNameProof, consumePublicNameProof
} = require('../services/ciePublicIdentityProofStore');

const secret = 'test-secret-only-not-for-production-123456789';
process.env.IDENTITY_HMAC_SECRET = secret;
const fiscal = 'RSSMRA80A01H501U';

function redis() {
  const data = new Map();
  return {
    data,
    async set(k,v,opt) { assert.equal(opt.ex,TTL_SECONDS);data.set(k,v);return 'OK'; },
    async get(k) { return data.get(k) || null; },
    async getdel(k) { const v=data.get(k)||null;data.delete(k);return v; }
  };
}

test('CIE names are account bound, ephemeral and consumed once', async () => {
  const client = redis();
  const names = { givenName: 'Giovanna', familyName: 'Bianchi' };
  await savePublicNameProof('citizen-1', names, client);
  assert.deepEqual(await peekPublicNameProof('citizen-1',client),names);
  assert.equal(await peekPublicNameProof('citizen-2',client),null);
  assert.deepEqual(await consumePublicNameProof('citizen-1',client),names);
  assert.equal(await consumePublicNameProof('citizen-1',client),null);
  assert.equal(JSON.stringify([...client.data.values()]).includes(fiscal),false);
});

test('fresh certified names can be bound only to the same person_key', async () => {
  const db = {async query(_sql,params){
    assert.deepEqual(params,['citizen-1']);
    return {rows:[{person_key:derivePersonKey(fiscal)}]};
  }};
  await assertSameVerifiedPerson('citizen-1',fiscal,db);
  await assert.rejects(
    assertSameVerifiedPerson('citizen-1','BNCGNN80A41H501Q',db),
    /non corrispondente/
  );
});

test('missing identity blocks name proof and malformed names fail closed', async () => {
  await assert.rejects(
    assertSameVerifiedPerson('citizen-1',fiscal,{query:async()=>({rows:[]})}),
    /non corrispondente/
  );
  await assert.rejects(
    savePublicNameProof('citizen-1',{givenName:'',familyName:'X'},redis()),
    /incompleti/
  );
});

test('atomic Redis consumption is required; no GET/DEL race fallback', async () => {
  await assert.rejects(
    consumePublicNameProof('citizen-1',{get: async()=>null}),
    /GETDEL/
  );
});
