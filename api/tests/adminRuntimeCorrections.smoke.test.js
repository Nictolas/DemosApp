'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Admin operational dashboards use method-first API requests and unwrap verified payloads', () => {
  const checks = [
    ['client/src/pages/RateLimitingDashboard.tsx', '/admin/rate-limiting/dashboard'],
    ['client/src/pages/ValidationDashboard.tsx', '/admin/validation/stats'],
    ['client/src/pages/LoggingDashboard.tsx', '/admin/logging/stats'],
  ];
  for (const [file, endpoint] of checks) {
    const source = read(file);
    assert.match(source, /apiRequest\('GET',/);
    assert.match(source, /response\.ok && response\.data\?\.success === true/);
    assert.ok(source.includes(endpoint));
    assert.doesNotMatch(source, /apiRequest\(\s*['\x22]\/admin\/(?:logging|rate-limiting|validation)[^'\x22]*['\x22]\s*,\s*['\x22](?:GET|POST)['\x22]/);
  }
});

test('Log export uses the canonical auth token rather than an obsolete localStorage key', () => {
  const source = read('client/src/pages/LoggingDashboard.tsx');
  assert.match(source, /getAuthToken\(\)/);
  assert.doesNotMatch(source, /localStorage\.getItem\(['\x22]token['\x22]\)/);
  assert.match(source, /if \(!token\) throw new Error/);
});

test('Admin-only pages do not rely on legacy AD role strings', () => {
  const pages = [
    'client/src/pages/Riconoscimenti.tsx',
    'client/src/pages/MetricheEndpoint.tsx',
    'client/src/pages/AuditDashboard/index.tsx',
    'client/src/pages/VotiPoliticiFinali.tsx',
    'client/src/pages/Admin/GDPRLegalManagement/index.tsx',
  ];
  for (const file of pages) {
    const source = read(file);
    assert.match(source, /hasAdminCapability\(user\)/);
    assert.doesNotMatch(source, /user\?\.ruolo\s*===\s*['\x22]AD['\x22]/);
  }
});

test('GDPR Admin overview never displays fabricated requests, policy dates or compliance labels', () => {
  const source = read('client/src/pages/Admin/GDPRLegalManagement/index.tsx');
  assert.match(source, /\/dpo\/overview/);
  assert.match(source, /gdpr_requests_total/);
  assert.match(source, /gdpr_requests_migration_excluded/);
  assert.doesNotMatch(source, /Dati mock|user@example\.com|pendingRequests:\s*8|totalRequests:\s*45/);
  assert.doesNotMatch(source, /setLocation\(['\x22]\/admin['\x22]\)/);
  const docs = read('client/src/pages/LegalDocuments.tsx');
  assert.doesNotMatch(docs, /gdprCompliant:\s*true|2024-01-15|console\.log\(['\x22](Modifica documento|Download documento)/);
});

test('Retired app JSON backup cannot be launched via Admin UI', () => {
  const page = read('client/src/pages/BackupDashboard.tsx');
  const backend = read('api/routes/admin/backup.js');
  assert.match(page, /legacy ritirato/);
  assert.match(backend, /legacyBackupActionUnavailable/);
  assert.doesNotMatch(page, /\/admin\/backup\/(create|restore|job\/start|job\/immediate|cleanup)/);
});

test('Opening monitoring dashboard and viewing retention data must not mutate backend', () => {
  const monitor = read('client/src/pages/MonitoringDashboard.tsx');
  assert.match(monitor, /void loadAllData\(\)/);
  assert.doesNotMatch(monitor, /if \(mounted && !currentlyMonitoring\)/);
  const retention = read('client/src/pages/DataRetention.tsx');
  assert.match(retention, /policiesRes\.data\?\.success === true/);
  assert.match(retention, /window\.confirm\(/);
});
