const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {redeemRenewalCredential}=require('../services/researchRenewalRedemptionService');
const args={credentialDigest:Buffer.from('blind-renew-digest'),purpose:'renew',epoch:'2027-Q1',participantPublicKey:Buffer.from('pseudonymous-key'),credentialVersion:1};
const client=(missing=false)=>{const calls=[];return{calls,query:async(sql)=>{calls.push(sql);const n=sql.trim().toLowerCase();if(['begin','commit','rollback'].includes(n))return{rows:[]};if(n.includes('spent_credentials'))return{rows:[{}]};if(n.includes('update research.participants'))return{rows:missing?[]:[{participant_id:'shadow',status:'active',expires_at:'2028-01-01'}]};throw new Error('unexpected query')}}};
test('renewal atomically consumes unlinkable credential and extends pseudonymous lease',async()=>{const c=client();const r=await redeemRenewalCredential(c,args);assert.equal(r.redeemed,true);assert.match(c.calls[2],/expires_at = NOW\(\) \+ INTERVAL '365 days'/i);assert.match(c.calls[2],/participant_public_key = \$1/i);assert.match(c.calls[2],/status IN \('active', 'expired'\)/i);assert.equal(c.calls.at(-1),'COMMIT')});
test('renewal cannot create or reactivate a participant when key is unknown or revoked',async()=>{const c=client(true);assert.deepEqual(await redeemRenewalCredential(c,args),{redeemed:false,participant:null});assert.match(c.calls[2],/status IN \('active', 'expired'\)/i);assert.equal(c.calls.at(-1),'ROLLBACK')});
test('renewal rejects enrollment purpose before transaction',async()=>{const c=client();await assert.rejects(()=>redeemRenewalCredential(c,{...args,purpose:'enroll'}));assert.equal(c.calls.length,0)});
test('renewal source contains no Identity identifiers or connector',()=>{const s=fs.readFileSync(path.join(__dirname,'..','services','researchRenewalRedemptionService.js'),'utf8').toLowerCase();for(const x of ['identity.','account_id','user_id','email','jwt_secret'])assert.equal(s.includes(x),false)});


test('renewal rolls back credential consumption when participant update throws', async () => {
  const calls = [];
  const c = {
    query: async (sql) => {
      calls.push(sql);
      const n = sql.trim().toLowerCase();
      if (n === 'begin' || n === 'rollback') return { rows: [] };
      if (n.includes('spent_credentials')) return { rows: [{}] };
      if (n.includes('update research.participants')) throw new Error('fixture participant update failed');
      throw new Error('unexpected query');
    }
  };
  await assert.rejects(() => redeemRenewalCredential(c, args), /participant update failed/i);
  assert.equal(calls[0], 'BEGIN');
  assert.match(calls[1], /spent_credentials/i);
  assert.match(calls[2], /update research\.participants/i);
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(calls.includes('COMMIT'), false);
});

test('renewal replay rejection rolls back before participant lease mutation', async () => {
  const calls = [];
  const c = {
    query: async (sql) => {
      calls.push(sql);
      const n = sql.trim().toLowerCase();
      if (n === 'begin' || n === 'rollback') return { rows: [] };
      if (n.includes('spent_credentials')) return { rows: [] };
      if (n.includes('update research.participants')) assert.fail('replay reached participant update');
      throw new Error('unexpected query');
    }
  };
  assert.deepEqual(
    await redeemRenewalCredential(c, args),
    { redeemed: false, participant: null }
  );
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(calls.some((sql) => /update research\.participants/i.test(sql)), false);
});

test('renewal SQL and parameters carry no Identity account context', async () => {
  const calls = [];
  const c = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      const n = sql.trim().toLowerCase();
      if (n === 'begin' || n === 'commit' || n === 'rollback') return { rows: [] };
      if (n.includes('spent_credentials')) return { rows: [{}] };
      if (n.includes('update research.participants')) return {
        rows: [{ participant_id: 'shadow', status: 'active', credential_version: 1 }]
      };
      throw new Error('unexpected query');
    }
  };
  const result = await redeemRenewalCredential(c, args);
  assert.equal(result.redeemed, true);
  const serialized = JSON.stringify(calls);
  assert.equal(serialized.includes('account_id'), false);
  assert.equal(serialized.includes('user_id'), false);
  assert.equal(serialized.includes('email'), false);
  assert.equal(serialized.includes('identity.'), false);
  assert.deepEqual(calls[1].params, [args.credentialDigest, 'renew', args.epoch]);
  assert.deepEqual(calls[2].params, [args.participantPublicKey, 1]);
});
