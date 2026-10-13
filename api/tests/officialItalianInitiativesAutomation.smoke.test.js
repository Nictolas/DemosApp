const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Ministero sync is the canonical automatic source for Italian initiatives and referenda', () => {
  const src = read('api/services/ministeroSync.js');
  assert.match(src, /firmereferendum\.giustizia\.it\/referendum\/api-portal\/iniziativa\/public/);
  assert.match(src, /resolveProcessTypeFromSource/);
  assert.match(src, /getSignatureThreshold/);
  assert.doesNotMatch(src, /return 500000|return 50000/);
  assert.match(src, /extracted\.quorum_raggiunto = signatureThreshold !== null/);
  assert.doesNotMatch(src, /extracted\.quorum_raggiunto = false/);
});

test('initiative priority uses concluded official signature collection and does not require parliamentary review', () => {
  const initiatives = read('api/routes/iniziative-popolari.js');
  const registry = read('api/config/civicProcesses.js');
  const readService = read('api/services/civicProcessReadService.js');
  assert.doesNotMatch(initiatives, /PARLIAMENTARY_SOURCE_REQUIRED/);
  assert.doesNotMatch(initiatives, /required_stage: 'parliamentary_review'/);
  assert.match(initiatives, /signature_collection_closed_and_threshold_reached/);
  assert.match(readService, /PRIORITY_SOURCE_STAGES/);
  assert.match(readService, /payload_metadata->>'signatures'/);
  assert.match(readService, /payload_metadata->>'quorumReached'/);
  assert.doesNotMatch(readService, /cp\.canonical_stage =/);
  assert.match(registry, /\[CIVIC_PROCESS_STAGES\.COLLECTION_CLOSED\][\s\S]*demos_priority: true/);
});

test('legacy manual tables no longer feed public lists, rankings or canonical vote eligibility', () => {
  const initiatives = read('api/routes/iniziative-popolari.js');
  const referenda = read('api/routes/referendum-abrogativi.js');
  assert.match(initiatives, /iniziativePopolariResult = \{ rows: \[\] \}/);
  const votePostStart = initiatives.indexOf("router.post('/vota'");
  const voteDeleteStart = initiatives.indexOf("router.delete('/vota'", votePostStart);
  const votePost = initiatives.slice(votePostStart, voteDeleteStart);
  assert.match(votePost, /getPriorityEligiblePopularInitiative/);
  assert.match(votePost, /INSERT INTO voti_iniziative_popolari/);
  assert.doesNotMatch(votePost, /FROM iniziative_popolari|JOIN iniziative_popolari/);
  assert.match(initiatives, /FROM iniziative_popolari ip[\s\S]*WHERE FALSE/);
  assert.match(referenda, /referendumAbrogativiResult = \{ rows: \[\] \}/);
});

test('manual proposal endpoints are retired and old client URLs redirect to official lists', () => {
  const initiatives = read('api/routes/iniziative-popolari.js');
  const referenda = read('api/routes/referendum-abrogativi.js');
  const app = read('client/src/App.tsx');
  assert.match(initiatives, /PROPOSTA_MANUALE_DISABILITATA/);
  assert.match(referenda, /PROPOSTA_MANUALE_DISABILITATA/);
  assert.match(app, /path="\/proponi-iniziativa-popolare"[\s\S]*Redirect to="\/iniziative-popolari"/);
  assert.match(app, /path="\/proponi-referendum-abrogativi"[\s\S]*Redirect to="\/referendum-abrogativi"/);
  assert.doesNotMatch(app, /import ProponiIniziativaPopolare/);
  assert.doesNotMatch(app, /import ProponiReferendumAbrogativi/);
});

test('Ministero collection sync and canonical multi-source sync remain separately opt-in', () => {
  const ministryJob = read('api/jobs/ministeroSyncJob.js');
  const civicJob = read('api/jobs/civicProcessSyncJob.js');
  const app = read('api/app.js');
  assert.match(ministryJob, /MINISTERO_SYNC_INTERVAL_MS/);
  assert.match(ministryJob, /MINISTERO_SYNC_IN_CORSO_INTERVAL_MS/);
  assert.match(app, /ENABLE_MINISTERO_SYNC/);
  assert.match(app, /ministeroSyncJob\.start\(\)/);
  assert.match(civicJob, /syncItalianPopularInitiativesSources/);
  assert.match(civicJob, /CIVIC_PROCESS_SYNC_INTERVAL_MS/);
  assert.match(app, /ENABLE_CIVIC_PROCESS_SYNC === 'true'/);
  assert.match(app, /civicProcessSyncJob\.start\(\)/);
});
