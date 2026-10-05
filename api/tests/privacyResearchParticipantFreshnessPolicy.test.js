const test=require('node:test');const assert=require('node:assert/strict');
const {MAX_INACTIVITY_DAYS,computeResearchParticipantExpiry,isResearchContributionCurrent,expireStaleResearchParticipants}=require('../services/researchParticipantFreshnessPolicy');

test('Research participant freshness is fixed to 365 days from account activity',()=>{
 assert.equal(MAX_INACTIVITY_DAYS,365);
 assert.equal(computeResearchParticipantExpiry('2026-01-01T00:00:00Z').toISOString(),'2027-01-01T00:00:00.000Z');
});
test('expired contributions fail closed at the boundary',()=>{
 assert.equal(isResearchContributionCurrent({expiresAt:'2027-01-01T00:00:00Z',now:'2026-12-31T23:59:59Z'}),true);
 assert.equal(isResearchContributionCurrent({expiresAt:'2027-01-01T00:00:00Z',now:'2027-01-01T00:00:00Z'}),false);
 assert.equal(isResearchContributionCurrent({expiresAt:'bad',now:'2026-01-01T00:00:00Z'}),false);
});
test('freshness sweep expires only already-due active pseudonymous participants',async()=>{
 const calls=[];const client={query:async(sql,params)=>{calls.push({sql,params});return{rows:[{participant_id:'shadow'}]}}};
 await expireStaleResearchParticipants(client,{now:'2027-01-01T00:00:00Z'});
 assert.equal(calls.length,1);assert.match(calls[0].sql,/UPDATE research\.participants/i);
 assert.match(calls[0].sql,/status = 'active'/i);assert.match(calls[0].sql,/expires_at <= \$1/i);
 assert.doesNotMatch(calls[0].sql,/account_id|user_id|email/i);
});


test('current opinion projection excludes expired and revoked participants at query time', () => {
 const fs=require('node:fs');const path=require('node:path');
 const sql=fs.readFileSync(path.join(__dirname,'..','..','supabase','schemas','privacy_first_shadow.sql'),'utf8');
 const view=sql.match(/create or replace view research\.current_opinion_responses[\s\S]*?;/i)?.[0]||'';
 assert.match(view,/join research\.participants p on p\.participant_id = e\.participant_id/i);
 assert.match(view,/p\.status = 'active'/i);
 assert.match(view,/p\.expires_at > now\(\)/i);
 assert.doesNotMatch(view,/identity\.|account_id|user_id|email/i);
});

test('participant-owned dimensions and opinion events are cascade-deleted with the pseudonymous participant', () => {
 const fs=require('node:fs');const path=require('node:path');
 const sql=fs.readFileSync(path.join(__dirname,'..','..','supabase','schemas','privacy_first_shadow.sql'),'utf8');
 const dimensionBlock=sql.match(/create table if not exists research\.participant_dimensions[\s\S]*?\);/i)?.[0]||'';
 const opinionBlock=sql.match(/create table if not exists research\.opinion_response_events[\s\S]*?\);/i)?.[0]||'';
 assert.match(dimensionBlock,/references research\.participants\(participant_id\) on delete cascade/i);
 assert.match(opinionBlock,/references research\.participants\(participant_id\) on delete cascade/i);
});

test('freshness sweep returns only pseudonymous participant ids and never Identity linkage', async()=>{
 const calls=[];const client={query:async(sql,params)=>{calls.push({sql,params});return{rows:[]}}};
 await expireStaleResearchParticipants(client,{now:'2027-01-01T00:00:00Z'});
 const {sql}=calls[0];
 assert.match(sql,/RETURNING participant_id/i);
 assert.doesNotMatch(sql,/participant_public_key|account_id|user_id|email|identity\./i);
 assert.deepEqual(calls[0].params,[new Date('2027-01-01T00:00:00Z')]);
});


test('aggregate publication suppresses small cells and has no implicit threshold',()=>{
 const {publishResearchAggregateCell}=require('../services/researchAggregatePublicationPolicy');
 assert.deepEqual(publishResearchAggregateCell({answerCode:'f',participantCount:7,minimumCellSize:8}),{answerCode:'f',suppressed:true,participantCount:null});
 assert.deepEqual(publishResearchAggregateCell({answerCode:'f',participantCount:8,minimumCellSize:8}),{answerCode:'f',suppressed:false,participantCount:8});
 assert.throws(()=>publishResearchAggregateCell({answerCode:'f',participantCount:100}),/Explicit aggregate minimum cell size/);
});

test('aggregate publication discards pseudonymous source metadata',()=>{
 const {publishResearchAggregateRows}=require('../services/researchAggregatePublicationPolicy');
 const result=publishResearchAggregateRows([
  {answer_code:'f',participant_count:'12',participant_id:'source-a'},
  {answer_code:'c',participant_count:'3',participant_public_key:'source-b'}
 ],{minimumCellSize:8});
 assert.deepEqual(result,[
  {answerCode:'f',suppressed:false,participantCount:12},
  {answerCode:'c',suppressed:true,participantCount:null},
  {answerCode:'i',suppressed:true,participantCount:null}
 ]);
 const serialized=JSON.stringify(result);
 assert.equal(serialized.includes('participant_id'),false);
 assert.equal(serialized.includes('participant_public_key'),false);
 assert.equal(serialized.includes('source-a'),false);
 assert.equal(serialized.includes('source-b'),false);
});
