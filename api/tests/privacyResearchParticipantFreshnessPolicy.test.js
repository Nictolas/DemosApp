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
