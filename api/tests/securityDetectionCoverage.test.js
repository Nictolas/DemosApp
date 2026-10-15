const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_RULES, DetectionEngine } = require('../security-agent/detectionEngine');

const now = new Date('2026-10-05T12:00:00.000Z');
const cases = [
  ['DET-AUTH-FAILED-BURST','auth','login.failed','high'],
  ['DET-BRUTE-FORCE','auth','auth.brute_force','high'],
  ['DET-ADMIN-FAILED-BURST','auth','admin.login.failed','critical'],
  ['DET-ADMIN-EXCESSIVE','admin','admin.access.excessive','high'],
  ['DET-SUSPICIOUS-REQUEST','application','request.suspicious','critical'],
  ['DET-RATE-LIMIT-SURGE','edge','rate_limit.triggered','medium'],
  ['DET-UNAUTHORIZED-ACCESS','access','access.unauthorized','high'],
  ['DET-SECURITY-BREACH','security','security.breach','critical'],
  ['DET-DATA-BREACH','privacy','privacy.data_breach','critical'],
  ['DET-AUDIT-FAILURE','telemetry','telemetry.audit_failure','high'],
  ['DET-INTEGRITY-FAILURE','integrity','check.failed','critical'],
  ['DET-TELEMETRY-GAP','telemetry','heartbeat.missed','high']
];

function event(category,type,index=0,offsetMs=0){
  return {eventId:`synthetic-${type}-${index}`,timestamp:new Date(now.getTime()-offsetMs-index).toISOString(),category,type,severity:'info'};
}

test('coverage table matches every configured deterministic rule exactly once',()=>{
  assert.equal(cases.length,DEFAULT_RULES.length);
  assert.deepEqual(new Set(cases.map(c=>c[0])),new Set(DEFAULT_RULES.map(r=>r.id)));
});

for(const [id,category,type,severity] of cases){
  const rule=DEFAULT_RULES.find(r=>r.id===id);
  test(`${id} triggers at threshold with expected severity`,()=>{
    const events=Array.from({length:rule.threshold},(_,i)=>event(category,type,i));
    const finding=new DetectionEngine().evaluate(events,now).find(f=>f.ruleId===id);
    assert.ok(finding);
    assert.equal(finding.count,rule.threshold);
    assert.equal(finding.severity,severity);
  });
  test(`${id} stays quiet below threshold`,()=>{
    const count=Math.max(0,rule.threshold-1);
    const events=Array.from({length:count},(_,i)=>event(category,type,i));
    assert.equal(new DetectionEngine().evaluate(events,now).some(f=>f.ruleId===id),false);
  });
  test(`${id} ignores matching events outside its window`,()=>{
    const events=Array.from({length:rule.threshold},(_,i)=>event(category,type,i,rule.windowMs+1000));
    assert.equal(new DetectionEngine().evaluate(events,now).some(f=>f.ruleId===id),false);
  });
}
