const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  resolveBackupFilePath
} = require('../services/backupPathPolicy');
const {
  quotePgIdentifier,
  ensureOpinionResponseColumn
} = require('../services/opinionIdentifierPolicy');

test('backup path policy accepts only a simple file name contained in backup root', () => {
  const root = path.resolve('/tmp/demos-backups');
  const resolved = resolveBackupFilePath({
    backupDir: root,
    fileName: 'backup-2026_10.sql.enc'
  });

  assert.equal(resolved, path.join(root, 'backup-2026_10.sql.enc'));
  for (const fileName of ['../secret', 'nested/file.sql', '..', '.', 'bad name.sql']) {
    assert.equal(resolveBackupFilePath({ backupDir: root, fileName }), null);
  }
});

test('opinion identifier policy rejects SQL metacharacters before any database query', async () => {
  let calls = 0;
  const pool = { async query() { calls += 1; return { rows: [] }; } };

  assert.equal(quotePgIdentifier('safe_opinion_1'), '"safe_opinion_1"');
  assert.equal(quotePgIdentifier('x"; DROP TABLE users;--'), null);

  const result = await ensureOpinionResponseColumn({
    pool,
    opinionId: 'x"; DROP TABLE users;--'
  });

  assert.deepEqual(result, { created: false, reason: 'invalid_identifier' });
  assert.equal(calls, 0);
});

test('opinion identifier policy uses a parameterized existence check before controlled DDL', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [] };
      return { rows: [] };
    }
  };

  const result = await ensureOpinionResponseColumn({
    pool,
    opinionId: 'safe_opinion_1'
  });

  assert.deepEqual(result, { created: true });
  assert.deepEqual(calls[0].params, ['safe_opinion_1']);
  assert.match(calls[1].sql, /^ALTER TABLE opinioni_risposte ADD COLUMN "safe_opinion_1" TEXT$/);
});
