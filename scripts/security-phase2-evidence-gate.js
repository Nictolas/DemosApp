const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/security/phase2-rt-evidence-manifest-v0.53.json'),'utf8').replace(/^\uFEFF/,''));
const {DEFAULT_RULES}=require(path.join(root,'api/security-agent/detectionEngine.js'));
const ruleIds=new Set(DEFAULT_RULES.map(r=>r.id));
const allowedStatus=new Set(['partial','external-only','guardrail-only']);
assert.deepEqual(Object.keys(manifest.tests),['RT01','RT02','RT03','RT04','RT05','RT06']);
for(const [id,item] of Object.entries(manifest.tests)){
 assert.ok(allowedStatus.has(item.localStatus),`${id}: invalid local status`);
 assert.ok(Array.isArray(item.rules),`${id}: rules must be an array`);
 for(const rule of item.rules) assert.ok(ruleIds.has(rule),`${id}: missing detection rule ${rule}`);
 assert.ok(Array.isArray(item.externalRequired)&&item.externalRequired.length>0,`${id}: external validation must remain explicit`);
 assert.notEqual(item.localStatus,'passed',`${id}: local gate must not claim external pass`);
}
const boundary=fs.readFileSync(path.join(root,'api/security-agent/securityExecutionBoundary.js'),'utf8');
assert.match(boundary,/authorized:false/);assert.match(boundary,/executable:false/);assert.match(boundary,/actionRunnerAvailable:false/);
assert.match(boundary,/propose_session_revocation/);
console.log('Phase 2 RT evidence gate PASS');
console.log(`RT01-RT06 mapped: ${Object.keys(manifest.tests).length}/6`);
console.log(`Detection rules available: ${ruleIds.size}`);
console.log('External/staging criteria remain pending by contract.');
