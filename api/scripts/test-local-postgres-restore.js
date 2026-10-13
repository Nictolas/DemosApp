'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEST_HOST = '127.0.0.1';
const TEST_PORT = String(process.env.DEMOS_RESTORE_TEST_PORT || '55432');
const TEST_USER = 'demos_restore_test';
const TEST_DB = 'demos_restore_test';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-pg-restore-'));
const dataDir = path.join(tempRoot, 'data');
const dumpFile = path.join(tempRoot, 'restore-test.dump');
const logFile = path.join(tempRoot, 'postgres.log');

function findPgBin() {
  const candidates = [
    process.env.PG_BIN,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : null,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\16\\bin' : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const exe = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
    if (fs.existsSync(path.join(candidate, exe))) return candidate;
  }
  return null;
}

const pgBin = findPgBin();
if (!pgBin) {
  console.error('SKIP: PostgreSQL client/server tools not found. Set PG_BIN to a PostgreSQL bin directory.');
  process.exit(2);
}

function exe(name) {
  return path.join(pgBin, process.platform === 'win32' ? `${name}.exe` : name);
}

function run(name, args, { input, allowFailure = false } = {}) {
  const result = spawnSync(exe(name), args, {
    input,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, PGPASSWORD: '' },
  });
  if (!allowFailure && result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(`${name} failed (${result.status}): ${details}`);
  }
  return result;
}

function runQuiet(name, args, { allowFailure = false } = {}) {
  const result = spawnSync(exe(name), args, {
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, PGPASSWORD: '' },
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${name} failed (${result.status})`);
  }
  return result;
}

function connectionArgs(database = TEST_DB) {
  return ['-h', TEST_HOST, '-p', TEST_PORT, '-U', TEST_USER, '-d', database];
}

let started = false;
try {
  const occupied = run('pg_isready', ['-h', TEST_HOST, '-p', TEST_PORT], { allowFailure: true });
  if (occupied.status === 0) {
    throw new Error(`Refusing to use port ${TEST_PORT}: a PostgreSQL server is already accepting connections there.`);
  }

  run('initdb', ['-D', dataDir, '-U', TEST_USER, '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  runQuiet('pg_ctl', ['-D', dataDir, '-o', `-h ${TEST_HOST} -p ${TEST_PORT}`, '-l', logFile, 'start']);
  started = true;
  run('pg_isready', ['-h', TEST_HOST, '-p', TEST_PORT]);
  run('createdb', ['-h', TEST_HOST, '-p', TEST_PORT, '-U', TEST_USER, TEST_DB]);

  const seedSql = `
    CREATE TABLE users (
      id integer PRIMARY KEY,
      email text NOT NULL UNIQUE,
      profile jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE TABLE events (
      id integer PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL
    );
    CREATE INDEX idx_events_user ON events(user_id);
    INSERT INTO users(id,email,profile) VALUES
      (1,'alpha@example.test','{"role":"tester"}'),
      (2,'beta@example.test','{"role":"tester"}');
    INSERT INTO events(id,user_id,title) VALUES
      (10,1,'Alpha event'),
      (20,2,'Beta event');
  `;
  run('psql', [...connectionArgs(), '-v', 'ON_ERROR_STOP=1'], { input: seedSql });

  run('pg_dump', [
    '-h', TEST_HOST, '-p', TEST_PORT, '-U', TEST_USER,
    '-Fc', '--no-owner', '--no-privileges', '-f', dumpFile, TEST_DB,
  ]);

  run('dropdb', ['-h', TEST_HOST, '-p', TEST_PORT, '-U', TEST_USER, TEST_DB]);
  run('createdb', ['-h', TEST_HOST, '-p', TEST_PORT, '-U', TEST_USER, TEST_DB]);
  run('pg_restore', [
    '-h', TEST_HOST, '-p', TEST_PORT, '-U', TEST_USER, '-d', TEST_DB,
    '--no-owner', '--no-privileges', '--exit-on-error', dumpFile,
  ]);

  const verifySql = `
    SELECT COUNT(*) FROM users;
    SELECT COUNT(*) FROM events;
    SELECT COUNT(*) FROM pg_constraint WHERE conname='events_user_id_fkey';
    SELECT COUNT(*) FROM pg_indexes WHERE indexname='idx_events_user';
    SELECT string_agg(email||':'||(profile->>'role'),',' ORDER BY id) FROM users;
    SELECT string_agg(title,',' ORDER BY id) FROM events;
  `;
  const verification = run('psql', [...connectionArgs(), '-At', '-v', 'ON_ERROR_STOP=1', '-c', verifySql]);
  const lines = verification.stdout.trim().split(/\r?\n/);
  const expected = [
    '2',
    '2',
    '1',
    '1',
    'alpha@example.test:tester,beta@example.test:tester',
    'Alpha event,Beta event',
  ];
  if (JSON.stringify(lines) !== JSON.stringify(expected)) {
    throw new Error(`Restore verification mismatch: ${JSON.stringify(lines)}`);
  }

  console.log('PASS: isolated PostgreSQL pg_dump -> drop -> pg_restore verified schema, FK, index and data.');
} finally {
  if (started) {
    runQuiet('pg_ctl', ['-D', dataDir, 'stop', '-m', 'fast'], { allowFailure: true });
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
