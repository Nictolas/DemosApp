const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const serviceSource = read('services/backupService.js');
const routeSource = read('routes/admin/backup.js');
const appSource = read('app.js');
const restoreScript = read('scripts/test-local-postgres-restore.js');

test('legacy JSON backup cannot silently generate a new encryption key', () => {
  assert.match(serviceSource, /encryptionKey:\s*process\.env\.BACKUP_ENCRYPTION_KEY \|\| null/);
  assert.doesNotMatch(serviceSource, /encryptionKey:\s*process\.env\.BACKUP_ENCRYPTION_KEY \|\| this\.generateEncryptionKey\(\)/);
});

test('legacy application backup is explicitly retired from operational create and restore paths', () => {
  assert.match(serviceSource, /LEGACY_APP_BACKUP_RETIRED/);
  assert.match(serviceSource, /static assertLegacyBackupAvailable\(\)/);
  assert.match(serviceSource, /static async createFullBackup\(\) \{\s*this\.assertLegacyBackupAvailable\(\)/);
  assert.match(serviceSource, /static async createIncrementalBackup\(\) \{\s*this\.assertLegacyBackupAvailable\(\)/);
  assert.match(serviceSource, /static async restoreFromBackup\(backupFileName\) \{\s*this\.assertLegacyBackupAvailable\(\)/);
});

test('dangerous Admin backup actions fail closed before entering legacy implementation', () => {
  for (const route of [
    "'/create/full'",
    "'/create/incremental'",
    "'/restore/:fileName'",
    "'/cleanup'",
    "'/job/start'",
    "'/job/immediate'",
    "'/test/integrity'",
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(routeSource, new RegExp(`router\\.post\\(${escaped}, legacyBackupActionUnavailable`));
  }
  assert.match(routeSource, /res\.status\(error\.statusCode \|\| 410\)/);
});

test('production startup never launches the retired JSON backup job', () => {
  assert.match(appSource, /Legacy application JSON backup is retired and will not start/);
  assert.doesNotMatch(appSource, /if \(process\.env\.ENABLE_AUTOMATIC_BACKUP === 'true'\) \{\s*backupJob\.start\(\)/);
});

test('restore drill is isolated and uses native PostgreSQL dump and restore tools', () => {
  assert.match(restoreScript, /127\.0\.0\.1/);
  assert.match(restoreScript, /Refusing to use port/);
  assert.match(restoreScript, /run\('pg_dump'/);
  assert.match(restoreScript, /run\('dropdb'/);
  assert.match(restoreScript, /run\('pg_restore'/);
  assert.match(restoreScript, /fs\.rmSync\(tempRoot, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(restoreScript, /DATABASE_URL|NEON|SUPABASE/);
});
