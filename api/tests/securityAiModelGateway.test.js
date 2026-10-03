const test = require('node:test');
const assert = require('node:assert/strict');
const { buildModelGatewayConfig, SecurityAiModelGateway } = require('../security-agent/securityAiModelGateway');

function readyEnv(overrides={}) {
  return {
    SECURITY_AI_MODEL_GATEWAY_ENABLED:'true',
    SECURITY_AI_PROVIDER_POLICY_APPROVED:'true',
    SECURITY_AI_PROVIDER:'fake',
    SECURITY_AI_REGION:'eu-test',
    SECURITY_AI_MODEL:'mock-1',
    SECURITY_AI_PROVIDER_ALLOWLIST:'fake',
    SECURITY_AI_REGION_ALLOWLIST:'eu-test',
    SECURITY_AI_MODEL_ALLOWLIST:'mock-1',
    SECURITY_AI_TIMEOUT_MS:'1000',
    SECURITY_AI_MAX_REQUEST_COST_MICROS:'100',
    SECURITY_AI_DAILY_COST_BUDGET_MICROS:'250',
    SECURITY_AI_MAX_DAILY_REQUESTS:'3',
    ...overrides
  };
}
function adapter(overrides={}) {
  return {
    provider:'fake', region:'eu-test', model:'mock-1', simulated:true, toolAccess:false, writeAccess:false,
    async estimateCostMicros(){return 50;},
    async analyze(){return {output:{assessment:'suspicious',confidence:80,prioritySuggestion:'P1',summary:'x',hypotheses:[],recommendedActions:['investigate'],requiresHumanReview:true},costMicros:40};},
    ...overrides
  };
}

test('default config is disabled and blocked', ()=>{
  const c=buildModelGatewayConfig({});
  assert.equal(c.enabled,false); assert.equal(c.ready,false); assert.ok(c.blockers.includes('gateway_disabled'));
});
test('enabled requires explicit policy approval', ()=>{
  const c=buildModelGatewayConfig(readyEnv({SECURITY_AI_PROVIDER_POLICY_APPROVED:'false'}));
  assert.equal(c.ready,false); assert.ok(c.blockers.includes('provider_policy_not_approved'));
});
test('provider, region and model must each be allowlisted', ()=>{
  assert.ok(buildModelGatewayConfig(readyEnv({SECURITY_AI_PROVIDER_ALLOWLIST:'other'})).blockers.includes('provider_not_allowlisted'));
  assert.ok(buildModelGatewayConfig(readyEnv({SECURITY_AI_REGION_ALLOWLIST:'other'})).blockers.includes('region_not_allowlisted'));
  assert.ok(buildModelGatewayConfig(readyEnv({SECURITY_AI_MODEL_ALLOWLIST:'other'})).blockers.includes('model_not_allowlisted'));
});
test('ready config requires explicit budgets', ()=>{
  const c=buildModelGatewayConfig(readyEnv());
  assert.equal(c.ready,true); assert.equal(c.maxRequestCostMicros,100); assert.equal(c.dailyCostBudgetMicros,250);
});
test('adapter with tool/write access is rejected', ()=>{
  const c=buildModelGatewayConfig(readyEnv());
  assert.throws(()=>new SecurityAiModelGateway({config:c,providerAdapter:adapter({toolAccess:true})}),/tool\/write/);
});
test('adapter identity must match configured provider region and model', ()=>{
  const c=buildModelGatewayConfig(readyEnv());
  assert.throws(()=>new SecurityAiModelGateway({config:c,providerAdapter:adapter({region:'wrong'})}),/region mismatch/);
});
test('gateway returns validated non-executable output', async ()=>{
  const c=buildModelGatewayConfig(readyEnv());
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter()});
  const out=await g.analyze({incidents:[{rawLog:'secret'}]});
  assert.equal(out.executable,false); assert.deepEqual(out.toolCalls,[]); assert.equal(out.gateway.simulated,true);
  assert.equal(g.status().usage.successCount,1); assert.equal(g.status().usage.costMicros,40);
});
test('request cost cap blocks provider before analyze', async ()=>{
  let called=false;
  const c=buildModelGatewayConfig(readyEnv({SECURITY_AI_MAX_REQUEST_COST_MICROS:'20'}));
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter({async analyze(){called=true;}})});
  await assert.rejects(()=>g.analyze({}),/AI_MODEL_REQUEST_COST_LIMIT/); assert.equal(called,false);
});
test('daily cost budget blocks subsequent request', async ()=>{
  const c=buildModelGatewayConfig(readyEnv({SECURITY_AI_DAILY_COST_BUDGET_MICROS:'80'}));
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter()});
  await g.analyze({});
  await assert.rejects(()=>g.analyze({}),/AI_MODEL_DAILY_COST_LIMIT/);
});
test('daily request cap is enforced', async ()=>{
  const c=buildModelGatewayConfig(readyEnv({SECURITY_AI_MAX_DAILY_REQUESTS:'1'}));
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter()});
  await g.analyze({}); await assert.rejects(()=>g.analyze({}),/AI_MODEL_DAILY_REQUEST_LIMIT/);
});
test('invalid model output fails closed with generic code', async ()=>{
  const c=buildModelGatewayConfig(readyEnv());
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter({async analyze(){return {output:{bad:true},costMicros:10};}})});
  await assert.rejects(()=>g.analyze({}),/AI_MODEL_OUTPUT_INVALID/);
});
test('provider failures are mapped to generic code', async ()=>{
  const c=buildModelGatewayConfig(readyEnv());
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter({async analyze(){throw new Error('token=SECRET host=internal');}})});
  await assert.rejects(()=>g.analyze({}),/AI_MODEL_PROVIDER_FAILED/);
  assert.equal(g.status().lastErrorCode,'AI_MODEL_PROVIDER_FAILED');
});
test('actual cost may not exceed estimate', async ()=>{
  const c=buildModelGatewayConfig(readyEnv());
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter({async analyze(){return {output:{assessment:'benign',confidence:50,prioritySuggestion:'P3',summary:'x'},costMicros:75};}})});
  await assert.rejects(()=>g.analyze({}),/AI_MODEL_COST_ACCOUNTING_VIOLATION/);
});
test('provider timeout fails closed with generic code', async ()=>{
  const c=buildModelGatewayConfig(readyEnv({SECURITY_AI_TIMEOUT_MS:'1000'}));
  const g=new SecurityAiModelGateway({config:c,providerAdapter:adapter({async analyze(){return new Promise(()=>{});}})});
  await assert.rejects(()=>g.analyze({}),/AI_MODEL_TIMEOUT/);
  assert.equal(g.status().lastErrorCode,'AI_MODEL_TIMEOUT');
});
test('status exposes no arbitrary secret env fields', ()=>{
  const c=buildModelGatewayConfig(readyEnv({SECURITY_AI_API_KEY:'SECRET'}));
  const g=new SecurityAiModelGateway({config:c,providerAdapter:null});
  const s=JSON.stringify(g.status());
  assert.equal(s.includes('SECRET'),false);
});
