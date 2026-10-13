const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Ministero sync delegates type resolution and signature thresholds to the civic registry', () => {
  const src = read('api/services/ministeroSync.js');
  assert.match(src, /civicProcessRegistryService/);
  assert.match(src, /resolveProcessTypeFromSource/);
  assert.match(src, /getSignatureThreshold/);
  assert.doesNotMatch(src, /return 500000|return 50000/);
  assert.match(src, /COALESCE\(firme_raccolte, 0\) >= \$1/);
  assert.match(src, /COALESCE\(firme_raccolte, 0\) >= \$2/);
});

test('legacy Ministero mapper emits canonical jurisdiction/process/source/stage metadata', () => {
  const src = read('api/utils/iniziativeMinisteroMapper.js');
  assert.match(src, /describeSourceRecord/);
  assert.match(src, /jurisdiction_id: civicMetadata\.jurisdictionId/);
  assert.match(src, /civic_process_type_id: civicMetadata\.civicProcessTypeId/);
  assert.match(src, /civic_process_stage: civicMetadata\.stageId/);
  assert.match(src, /civic_process_source_id: civicMetadata\.sourceId/);
  assert.match(src, /signature_threshold: civicMetadata\.signatureThreshold/);
  assert.match(src, /demos_actions: civicMetadata\.demosActions/);
});

test('legacy SQL query builder gets source matchers and thresholds from the registry profile', () => {
  const src = read('api/utils/iniziativeMinisteroMapper.js');
  assert.match(src, /getLegacyQueryProfile\(tipoFilter\)/);
  assert.match(src, /profile\?\.sqlLikePatterns/);
  assert.match(src, /profile\?\.signatureThreshold/);
  assert.doesNotMatch(src, /const firmeMinime = tipoFilter === 'referendum' \? 500000 : 50000/);
});

test('active Initiative route does not own the Italian signature threshold', () => {
  const src = read('api/routes/iniziative-popolari.js');
  assert.match(src, /getLegacyQueryProfile\('iniziativa'\)/);
  assert.match(src, /INIZIATIVA_FIRME_MINIME/);
  assert.doesNotMatch(src, /(?:^|[^0-9])50000(?:[^0-9]|$)/m);
});

test('active Italian collection UIs read signature threshold metadata from the API', () => {
  const initiatives = read('client/src/pages/IniziativePopolari/components/IniziativeTable.tsx');
  const referenda = read('client/src/pages/ReferendumAbrogativi/components/ReferendumTable.tsx');
  const initiativeTypes = read('client/src/pages/IniziativePopolari/types/index.ts');
  const referendumTypes = read('client/src/pages/ReferendumAbrogativi/types/index.ts');

  assert.match(initiatives, /iniziativa\.signature_threshold/);
  assert.doesNotMatch(initiatives, /const totaleMinimo = 50000/);
  assert.match(referenda, /referendum\.signature_threshold/);
  assert.doesNotMatch(referenda, />= 500000|< 500000/);
  assert.match(initiativeTypes, /civic_process_type_id\?: string/);
  assert.match(referendumTypes, /civic_process_type_id\?: string/);
});

test('architecture note defines the adapter boundary and avoids country forks', () => {
  const doc = read('ARCHITETTURA_GLOBALE_PROCESSI_CIVICI.md');
  assert.match(doc, /una sola piattaforma globale con un core condiviso/i);
  assert.match(doc, /fonti esterne sono adapter/i);
  assert.match(doc, /Ministero, Camera e Senato sono fonti dello stesso processo/i);
});
