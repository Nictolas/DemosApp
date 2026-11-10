'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Security summary uses real, Admin-only endpoints and never invokes an agent', () => {
  const ops = read('client/src/pages/Admin/OpsCenter.tsx');
  const monitoring = read('api/routes/admin/monitoring.js');
  const violations = read('api/routes/admin/violations.js');
  assert.match(ops, /Stato della sicurezza/);
  assert.doesNotMatch(ops, /AI Cybersecurity Agent/);
  assert.doesNotMatch(ops, /\/security-center\/health/);
  assert.match(ops, /apiRequest\.get<SystemHealth>\("\/admin\/monitoring\/health"\)/);
  assert.match(ops, /apiRequest\.get<\{ isMonitoring: boolean \}>\("\/admin\/monitoring\/status"\)/);
  assert.match(ops, /\/admin\/violations\/monitoring\/status/);
  assert.match(monitoring, /router\.use\(verifyToken, requireAdmin\)/);
  assert.match(violations, /router\.use\(requireAdmin\)/);
});

test('Absent or disabled monitoring is never represented as healthy or active', () => {
  const ops = read('client/src/pages/Admin/OpsCenter.tsx');
  assert.match(ops, /value === null \? "non verificabile"/);
  assert.match(ops, /value \? "attivo" : "disattivato"/);
  assert.match(ops, /securityStatus\.health\?\.summary/);
  assert.match(ops, /lastCheckedAt: health\?\.timestamp \?\? null/);
  assert.match(ops, /I dati non attestano l'assenza di attacchi/);
  assert.match(ops, /Nessun log viene trasmesso automaticamente/);
  assert.doesNotMatch(ops, /apiRequest\.post\(/);
  assert.doesNotMatch(ops, /\/monitoring\/start|\/monitoring\/stop|\/monitoring\/immediate/);
});

test('Existing Agent prototype remains read-only and cannot execute production actions', () => {
  const agent = read('api/security-agent/securityCenterMount.js');
  const app = read('api/app.js');
  assert.match(agent, /actionRunnerAvailable: false/);
  assert.match(agent, /authorized: false/);
  assert.match(agent, /executable: false/);
  assert.match(app, /if \(process\.env\.SECURITY_CENTER_RUNTIME_ENABLED === 'true'\)/);
});
