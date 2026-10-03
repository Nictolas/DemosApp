const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {revokeResearchParticipant}=require('../services/researchParticipantRevocationService');
test('verified pseudonymous participant can be revoked immediately without Identity identifier',async()=>{const calls=[];const client={query:async(sql,params)=>{calls.push({sql,params});return{rows:[{participant_id:'shadow'}]}}};assert.deepEqual(await revokeResearchParticipant(client,{participantPublicKey:Buffer.from('key'),participantSignatureVerified:true}),{revoked:true});assert.match(calls[0].sql,/status = 'revoked'/i);assert.match(calls[0].sql,/expires_at = LEAST\(expires_at, NOW\(\)\)/i);assert.deepEqual(calls[0].params,[Buffer.from('key')])});
test('revocation fails closed without verified participant proof',async()=>{let n=0;const client={query:async()=>{n++;return{rows:[]}}};await assert.rejects(()=>revokeResearchParticipant(client,{participantPublicKey:Buffer.from('key'),participantSignatureVerified:false}),/Verified pseudonymous/);assert.equal(n,0)});
test('revocation service contains no Identity linkage',()=>{const src=fs.readFileSync(path.join(__dirname,'..','services','researchParticipantRevocationService.js'),'utf8').toLowerCase();for(const x of ['identity.','account_id','user_id','email','jwt_secret'])assert.equal(src.includes(x),false)});
test('shadow participant lease is bounded from last confirmation, allowing later renewals',()=>{const sql=fs.readFileSync(path.join(__dirname,'..','..','supabase','schemas','privacy_first_shadow.sql'),'utf8');assert.match(sql,/expires_at <= last_confirmed_at \+ interval '365 days'/i);assert.doesNotMatch(sql,/expires_at <= created_at \+ interval '365 days'/i)});


test('revocation immediately makes participant contributions ineligible for current projections',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','..','supabase','schemas','privacy_first_shadow.sql'),'utf8');
 const view=sql.match(/create or replace view research\.current_opinion_responses[\s\S]*?;/i)?.[0]||'';
 assert.match(view,/where p\.status = 'active'/i);
 assert.match(view,/and p\.expires_at > now\(\)/i);
 const service=fs.readFileSync(path.join(__dirname,'..','services','researchParticipantRevocationService.js'),'utf8');
 assert.match(service,/SET status = 'revoked', expires_at = LEAST\(expires_at, NOW\(\)\)/i);
});

test('physical deletion of a pseudonymous participant removes owned research rows without an Identity lookup',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','..','supabase','schemas','privacy_first_shadow.sql'),'utf8');
 const owned=['participant_dimensions','opinion_response_events'];
 for(const table of owned){
  const start='create table if not exists research.'+table; const startIndex=sql.toLowerCase().indexOf(start); assert.notEqual(startIndex,-1); const block=sql.slice(startIndex,sql.indexOf(';',startIndex)+1);
  assert.match(block,/references research\.participants\(participant_id\) on delete cascade/i);
  assert.doesNotMatch(block,/identity\.|account_id|user_id|email/i);
 }
});
