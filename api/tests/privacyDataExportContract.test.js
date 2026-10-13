const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('data export UI uses canonical authenticated API helper', () => {
  const page = read('client/src/pages/Impostazioni/ScaricaDati/index.tsx');
  assert.match(page, /apiRequest\(/);
  assert.match(page, /\/api\/user\/download-data\?type=/);
  assert.doesNotMatch(page, /user\.token/);
  assert.doesNotMatch(page, /setTimeout\([^)]*2000/);
});

test('download route delegates to schema-aware export service', () => {
  const route = read('api/routes/user/download-data.js');
  assert.match(route, /PrivacyDataExportService\.buildExport/);
  assert.match(route, /verifyToken/);
  assert.doesNotMatch(route, /FROM\s+opinioni_domande/i);
  assert.doesNotMatch(route, /candidato\s+as\s+dettaglio/i);
  assert.doesNotMatch(route, /WHERE\s+user_id\s*=\s*\$1[\s\S]*UNION ALL/i);
});

test('schema-aware export uses whitelists and redacts technical credentials', () => {
  const service = read('api/services/privacyDataExportService.js');
  assert.match(service, /information_schema\.columns/);
  assert.match(service, /ACTIVITY_TABLES/);
  assert.match(service, /COMMUNICATION_TABLES/);
  assert.match(service, /redactTechnicalSecrets/);
  assert.match(service, /password\|secret\|token\|credential/);
  assert.match(service, /opinioni_risposte/);
  assert.doesNotMatch(service, /password_hash/);
});
