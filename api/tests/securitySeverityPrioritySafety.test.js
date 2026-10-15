const test=require('node:test');const assert=require('node:assert/strict');
const {DEFAULT_RULES}=require('../security-agent/detectionEngine');
const {buildSecurityAlerts}=require('../security-agent/securityAlertPolicy');
const {evaluateActionPolicy,evaluateAiPolicy,policyStatus}=require('../security-agent/securityPolicyEngine');

const severityPriority={critical:'P0',high:'P1',medium:'P2',low:'P3',info:'P3'};
const priorityRank={P0:0,P1:1,P2:2,P3:3};

test('every deterministic severity maps monotonically to alert priority',()=>{
 for(const rule of DEFAULT_RULES){
  const counts={info:0,low:0,medium:0,high:0,critical:0}; counts[rule.severity]=1;
  const result=buildSecurityAlerts({agentHealth:{level:'green'},telemetry:{status:'healthy'},openBySeverity:counts});
  assert.equal(result.highestPriority,severityPriority[rule.severity],rule.id);
 }
});

test('adding lower-severity incidents cannot reduce an existing alert priority',()=>{
 const severities=['critical','high','medium','low','info'];
 for(const primary of severities){
  const base={info:0,low:0,medium:0,high:0,critical:0};base[primary]=1;
  const expected=buildSecurityAlerts({agentHealth:{level:'green'},telemetry:{status:'healthy'},openBySeverity:base}).highestPriority;
  for(const extra of severities){
   const mixed={...base};mixed[extra]+=5;
   const actual=buildSecurityAlerts({agentHealth:{level:'green'},telemetry:{status:'healthy'},openBySeverity:mixed}).highestPriority;
   assert.ok(priorityRank[actual]<=priorityRank[expected],`${primary}+${extra} unexpectedly de-escalated`);
  }
 }
});

test('invalid and non-positive counts do not create incident alerts',()=>{
 const result=buildSecurityAlerts({agentHealth:{level:'green'},telemetry:{status:'healthy'},openBySeverity:{critical:-1,high:'bad',medium:NaN,low:0,info:null}});
 assert.equal(result.activeCount,0);assert.equal(result.highestPriority,null);
});

test('unknown actions and invalid priorities fail closed',()=>{
 assert.equal(evaluateActionPolicy('not_allowlisted',{priority:'P0'}).decision,'deny');
 assert.equal(evaluateActionPolicy('observe',{priority:'PX'}).decision,'deny');
 assert.equal(evaluateAiPolicy({prioritySuggestion:'PX',recommendedActions:['observe']}).decision,'deny');
});

test('P0 or explicit human review never becomes automatic execution',()=>{
 for(const action of ['observe','investigate','escalate_human','propose_rate_limit','propose_session_revocation','propose_endpoint_isolation','propose_secret_rotation']){
  const p0=evaluateActionPolicy(action,{priority:'P0'});assert.equal(p0.decision,'escalate');assert.equal(p0.executable,false);
  const review=evaluateActionPolicy(action,{priority:'P3',requiresHumanReview:true});assert.equal(review.decision,'escalate');assert.equal(review.executable,false);
 }
 const status=policyStatus();assert.equal(status.executable,false);assert.equal(status.actionRunnerAvailable,false);assert.equal(status.defaultUnknownDecision,'deny');
});
