'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectLine, kindFor, classifyRoleEvidence, inventory, markdown } = require('../../scripts/audit-user-role-migration');

test('inventory finds role references in SQL and JS without confusing status across all services', () => {
  assert.deepEqual(inspectLine("SELECT u.ruolo, u.account_type, u.status FROM users u"),
    ['legacy_role', 'account_type', 'account_status']);
  assert.deepEqual(inspectLine('if (user.is_admin) return true;'), ['capability']);
  assert.deepEqual(inspectLine('const state = task.status;'), []);
  assert.deepEqual(inspectLine('const role = minister.ruolo;'), ['legacy_role']);
});

test('classifies authorization, political, migration and client references', () => {
  assert.equal(kindFor('api/routes/auth/oauth.js'), 'AUTH_OR_AUTHORIZATION');
  assert.equal(kindFor('api/database/legacy-migration.sql'), 'MIGRATION_OR_SQL');
  assert.equal(kindFor('api/services/politicalEligibilityService.js'), 'POLITICAL_OR_ORGANIZATION');
  assert.equal(kindFor('client/src/pages/Utenti/index.tsx'), 'CLIENT');
  assert.equal(kindFor('api/tests/accountCapabilitiesService.test.js'), 'TEST');
});

test('inventory scans explicit test fixture safely and reports paths and lines, never source contents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-role-audit-'));
  try {
    fs.mkdirSync(path.join(root, 'api', 'routes', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(root, 'client', 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'api', 'routes', 'auth', 'oauth.js'),
      "const secret = 'test-synthetic-secret';\nif (u.status === 'a' && u.ruolo === 'P') return true;\n");
    fs.writeFileSync(path.join(root, 'client', 'src', 'view.tsx'), "user.account_type\n");
    fs.writeFileSync(path.join(root, 'node_modules', 'ignored.js'), 'user.ruolo');
    const result = inventory(root, [
      'api/routes/auth/oauth.js',
      'client/src/view.tsx',
      'node_modules/ignored.js'
    ]);
    assert.equal(result.scanned_tracked_files, 2);
    assert.equal(result.matched_files, 2);
    assert.equal(result.matched_lines, 2);
    assert.deepEqual(result.entries[0].signals, ['legacy_role', 'account_status']);
    assert.equal(result.entries[0].line, 2);
    assert.doesNotMatch(JSON.stringify(result), /test-synthetic-secret/);
    assert.match(markdown(result), /Read-only static inventory/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test('classifies role candidates conservatively without treating ministers as users', () => {
  assert.equal(classifyRoleEvidence("WHERE u.ruolo = 'P'"), 'EXPLICIT_SQL_ACCOUNT_FIELD');
  assert.equal(classifyRoleEvidence('user?.ruolo'), 'ACCOUNT_OBJECT_PROPERTY_CANDIDATE');
  assert.equal(classifyRoleEvidence('const role = ministro.ruolo;'), 'GENERIC_ROLE_UNRESOLVED');
  assert.equal(classifyRoleEvidence("SELECT ruolo FROM users"), 'SQL_FIELD_UNRESOLVED');
  assert.equal(classifyRoleEvidence('ruolo: accountSubject.legacyRole'), 'PAYLOAD_OR_FIELD_UNRESOLVED');
  assert.equal(classifyRoleEvidence('account_type: row.account_type'), null);
});

test('inventory aggregates evidence classes without exposing source content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-role-audit-evidence-'));
  try {
    fs.writeFileSync(path.join(root, 'fake.js'), "u.ruolo\nuser.ruolo\nminister.ruolo\n");
    const result = inventory(root, ['fake.js']);
    assert.equal(result.role_evidence_counts.EXPLICIT_SQL_ACCOUNT_FIELD, 1);
    assert.equal(result.role_evidence_counts.ACCOUNT_OBJECT_PROPERTY_CANDIDATE, 1);
    assert.equal(result.role_evidence_counts.GENERIC_ROLE_UNRESOLVED, 1);
    assert.match(markdown(result), /Legacy role evidence/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
