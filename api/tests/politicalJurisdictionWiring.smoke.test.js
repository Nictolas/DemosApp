const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const files = {
  event: read('api/services/electionEventService.js'),
  eligibility: read('api/services/politicalEligibilityService.js'),
  lifecycle: read('api/services/electionLifecycleService.js'),
  push: read('api/services/currentSupporterPushService.js'),
  candidates: read('api/routes/candidati.js'),
  representatives: read('api/routes/rappresentanti.js'),
  elections: read('api/routes/elezioni.js'),
  profile: read('api/routes/users/profile.js'),
  communications: read('api/routes/comunicazioni.js'),
  podium: read('api/routes/podio-trasparenza.js'),
  opinions: read('api/routes/opinioni/management.js'),
};

test('active political surfaces consume the shared jurisdiction registry', () => {
  for (const [name, source] of Object.entries(files)) {
    assert.match(source, /politicalJurisdictionRegistryService/, `${name} must use the shared political registry`);
  }
});

test('active routes no longer own duplicate office/election semantic maps', () => {
  assert.doesNotMatch(files.candidates, /const gradoMapping\s*=|const eligibilityGradeByField\s*=|const gradeByField\s*=/);
  assert.doesNotMatch(files.representatives, /const gradoMapping\s*=/);
  assert.doesNotMatch(files.elections, /const direct\s*=\s*\{|const names\s*=\s*\{/);
  assert.doesNotMatch(files.communications, /PARLAMENTOEUROPEO:\s*'EUROPEO'|CAMERADEIDEPUTATI:\s*'CAMERA'/);
  assert.doesNotMatch(files.lifecycle, /const byLevel\s*=\s*\{/);
  assert.doesNotMatch(files.opinions, /const gradoMapping\s*=\s*\{/);
});

test('legacy database columns remain compatibility projection, not the semantic registry', () => {
  const registry = read('api/config/politicalJurisdictions.js');
  assert.match(registry, /legacyRepresentativeField/);
  assert.match(registry, /legacyCandidateField/);
  assert.match(files.profile, /getLegacySelectionFields\('both'\)/);
  assert.match(files.push, /getLegacySelectionField/);
  assert.match(files.podium, /buildOfficePodiumCaseSql/);
});

test('opinion scopes are resolved through the registry instead of route-local labels', () => {
  assert.match(files.opinions, /normalizeOpinionScope/);
  assert.match(files.opinions, /getOpinionScopeLabel/);
});
