const test = require('node:test');
const assert = require('node:assert/strict');
const { SecurityAiShadowIntegration } = require('../security-agent/securityAiShadowIntegration');
const { SecurityCenterService } = require('../security-agent/securityCenterService');

function target(result) {
  return { status: () => ({ ready: true, simulated: true }), analyze: async () => result };
}
function config() { return { version: 'v0.22', enabled: true, backend: 'mock', ready: true, blockers: Object.freeze([]) }; }
function analysis(actions = ['observe'], extra = {}) {
  return { assessment:'benign', confidence:90, prioritySuggestion:'P3', summary:'safe', hypotheses:[], recommendedActions:actions, requiresHumanReview:false, executable:false, toolCalls:[], ...extra };
}
test('shadow output is evaluated by deterministic policy', async () => {
  const ai = new SecurityAiShadowIntegration({ config: config(), mockRunner: target(analysis(['observe'])) });
  const result = await ai.analyze({});
  assert.equal(result.policy.decision, 'allow');
  assert.equal(result.policy.executable, false);
});
test('mitigation proposal is escalated and never executable', async () => {
  const ai = new SecurityAiShadowIntegration({ config: config(), mockRunner: target(analysis(['propose_rate_limit'])) });
  const result = await ai.analyze({});
  assert.equal(result.policy.decision, 'escalate');
  assert.equal(result.executable, false);
  assert.equal(result.policy.executable, false);
});
test('P0 observation still escalates', async () => {
  const ai = new SecurityAiShadowIntegration({ config: config(), mockRunner: target(analysis(['observe'], { prioritySuggestion:'P0' })) });
  assert.equal((await ai.analyze({})).policy.decision, 'escalate');
});
test('status exposes aggregate policy counters only', async () => {
  const ai = new SecurityAiShadowIntegration({ config: config(), mockRunner: target(analysis(['observe'])) });
  await ai.analyze({ incidentId:'SECRET', ip:'10.0.0.1' });
  const text = JSON.stringify(ai.status());
  assert.match(text, /"allow":1/);
  assert.doesNotMatch(text, /SECRET|10\.0\.0\.1/);
  assert.equal(ai.status().policy.actionRunnerAvailable, false);
});
test('Security Center policy view strips analysis summary and hypotheses', async () => {
  const aiPolicy = { status:()=>({ policy:{ counters:{allow:1}, actionRunnerAvailable:false } }), listRecent:()=>[{ analyzedAt:'2026-10-03T10:00:00Z', summary:'DO NOT EXPOSE', hypotheses:[{code:'SECRET'}], policy:{decision:'allow',reasonCode:'READ_ONLY_ONLY',actionCount:1} }] };
  const store={listIncidents:async()=>[],getSourceState:async()=>null,stats:async()=>({incidentCount:0})};
  const service=new SecurityCenterService({runner:{status:()=>({enabled:false})},store,aiPolicy});
  const data=await service.getAiPolicy({limit:10});
  const text=JSON.stringify(data);
  assert.match(text,/READ_ONLY_ONLY/);
  assert.doesNotMatch(text,/DO NOT EXPOSE|SECRET/);
  assert.equal(data.decisions[0].executable,false);
});
test('Security Center fallback policy status has no action runner', async () => {
  const store={listIncidents:async()=>[],getSourceState:async()=>null,stats:async()=>({incidentCount:0})};
  const service=new SecurityCenterService({runner:{status:()=>({enabled:false})},store});
  const data=await service.getAiPolicy();
  assert.equal(data.status.actionRunnerAvailable,false);
  assert.deepEqual(data.decisions,[]);
});
