const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'docs/security/phase-evidence-manifest-v0.52.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));

function localEvidenceExists(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return false;
  if (ref.startsWith('sheet:')) return true;
  return fs.existsSync(path.join(root, ref));
}

for (const phaseName of ['phase0', 'phase1']) {
  const phase = manifest[phaseName];
  assert.ok(Array.isArray(phase.required) && phase.required.length > 0, `${phaseName}: required evidence list missing`);
  for (const key of phase.required) {
    assert.ok(Object.prototype.hasOwnProperty.call(phase.evidence, key), `${phaseName}: missing evidence mapping for ${key}`);
    assert.ok(localEvidenceExists(phase.evidence[key]), `${phaseName}: evidence unavailable for ${key}`);
  }
}

const foundation = fs.readFileSync(path.join(root, 'docs/security/security-agent-foundation-v0.1.md'), 'utf8');
assert.match(foundation, /shadow\/read-only/i);
assert.match(foundation, /Nessuna write verso produzione/i);

const runtime = fs.readFileSync(path.join(root, 'api/security-agent/securityAgentRuntime.js'), 'utf8');
assert.match(runtime, /SECURITY_AGENT_SHADOW_ENABLED/);

const boundary = fs.readFileSync(path.join(root, 'api/security-agent/securityExecutionBoundary.js'), 'utf8');
assert.match(boundary, /authorized:false/);
assert.match(boundary, /executable:false/);
assert.match(boundary, /actionRunnerAvailable:false/);

console.log('Phase 0/1 evidence gate PASS');
console.log(`Phase 0 evidence: ${manifest.phase0.required.length}/${manifest.phase0.required.length}`);
console.log(`Phase 1 evidence: ${manifest.phase1.required.length}/${manifest.phase1.required.length}`);
console.log('External/runtime claims remain explicitly outside this local gate.');
