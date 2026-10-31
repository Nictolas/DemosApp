'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const cliScripts = [
  'scripts/migrate-local.js',
  'scripts/migrate-neon-to-axiom.js',
  'scripts/migrate-neon-to-axiom-gdpr-only.js',
  'scripts/start-axiom-migration.js',
  'scripts/run-migration.js',
  'scripts/migrate-direct-http.js',
  'scripts/check-migration-config.js'
];

test('seven legacy CLI/diagnostic entrypoints reject before env, SQL or external I/O', () => {
  for (const relative of cliScripts) {
    const filename = path.join(repoRoot, relative);
    const source = readFileSync(filename, 'utf8');
    const guard = source.indexOf('exitRetiredLegacyAxiomMigration()');
    assert.ok(guard >= 0, relative + ': missing fail-closed guard');
    for (const marker of ["require('pg')", "require('axios')", "require('dotenv')"]) {
      const index = source.indexOf(marker);
      if (index >= 0) assert.ok(guard < index, relative + ': guard must run first');
    }

    const result = spawnSync(process.execPath, [filename, 'migrate', '--confirm'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 4000,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:1/not-a-db',
        AXIOM_API_TOKEN: 'synthetic-no-provider',
        AXIOM_ORG_ID: 'synthetic-no-provider',
        AXIOM_ENABLED: 'true',
        AXIOM_ANONYMIZE: 'false',
        AXIOM_ANONYMIZE_USER_ID: 'false'
      }
    });
    assert.equal(result.error, undefined, relative + ': unexpected process error');
    assert.equal(result.status, 78, relative + ': must refuse with fixed exit code');
    assert.equal(result.stdout, '', relative + ': no runtime activity before refusal');
    assert.match(result.stderr, /^LEGACY_AXIOM_MIGRATION_RETIRED: /, relative);
    assert.doesNotMatch(result.stderr, /synthetic-no-provider|postgresql:\/\//);
  }
});

test('all direct legacy migration service exports reject before initialization', async () => {
  const migration = require('../services/axiomMigrationService');
  const methods = ['migrateNeonToAxiom', 'migrateCentralizedLogs', 'migrateAuditLogs'];
  for (const method of methods) {
    await assert.rejects(
      migration[method](),
      error => error?.code === 'LEGACY_AXIOM_MIGRATION_RETIRED',
      method
    );
  }
});

test('Admin UI cannot offer migration, even via old method names', () => {
  const source = readFileSync(path.join(repoRoot, 'client/src/pages/DataExport.tsx'), 'utf8');
  assert.match(source, /Migrazione legacy verso Axiom ed eliminazione da Neon sospese/);
  assert.doesNotMatch(source, /startAxiomMigration|deleteMigratedData|\/admin\/axiom-migration\/(migrate|delete-migrated)/);
});
