'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('audit cleanup never executes a legacy delete without approved policy', () => {
  const s = read('services/auditService.js');
  const part = s.split('static async cleanupOldLogs(')[1]?.split('static async hasProcessingLimits(')[0];
  assert.ok(part);
  assert.match(part, /AUDIT_RETENTION_POLICY_NOT_APPROVED/);
  assert.match(part, /statusCode = 409/);
  assert.doesNotMatch(part, /DELETE\s+FROM/i);
  assert.match(s, /if \(process\.env\.AXIOM_ENABLED === 'true'\)/);
});

test('technical logging fallback cannot interpolate retentionDays into a DELETE', () => {
  const s = read('services/centralizedLogger.js');
  const part = s.split('async cleanupOldLogs(')[1]?.split('async exportLogs(')[0];
  assert.ok(part);
  assert.match(part, /LOG_RETENTION_POLICY_NOT_APPROVED/);
  assert.match(part, /statusCode = 409/);
  assert.doesNotMatch(part, /DELETE\s+FROM/i);
  assert.doesNotMatch(part, /INTERVAL.*retentionDays/);
});

test('admin cleanup routes distinguish unapproved policy from server failures', () => {
  const a = read('routes/admin/audit-dashboard.js');
  const l = read('routes/admin/logging.js');
  assert.match(a, /error\.code === 'AUDIT_RETENTION_POLICY_NOT_APPROVED' \? 409 : 500/);
  assert.match(l, /error\.code === 'LOG_RETENTION_POLICY_NOT_APPROVED' \? 409 : 500/);
});
