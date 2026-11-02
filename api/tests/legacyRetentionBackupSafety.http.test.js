'use strict';
// Authenticated real Express HTTP routers with synthetic-only services.
// Every destructive legacy method must fail closed before any DB/job/filesystem I/O.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const http = require('node:http');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const effects = { deletion: 0, backupRead: 0, jobStart: 0, jobStop: 0 };
const retentionRoute = require.resolve('../routes/admin/data-retention');
const backupRoute = require.resolve('../routes/admin/backup');
const originalLoad = Module._load;
const previous = new Map([retentionRoute, backupRoute].map(file => [file, require.cache[file]]));

const authenticate = (req, res, next) => {
  if (!req.headers.authorization) return res.status(401).json({ success: false });
  next();
};
const requireAdmin = (req, res, next) => {
  if (req.headers.authorization !== 'Bearer synthetic-admin') {
    return res.status(403).json({ success: false });
  }
  next();
};
const retiredError = () => {
  const err = new Error('Backup legacy disabilitato');
  err.statusCode = 410;
  err.code = 'LEGACY_APP_BACKUP_RETIRED';
  throw err;
};
const deleteDenied = () => {
  effects.deletion += 1;
  throw Error('DESTRUCTIVE_LEGACY_SERVICE_CALLED');
};
const retentionService = {
  deleteExpiredData: deleteDenied,
  deleteAllExpiredData: deleteDenied,
  performFullCleanup: deleteDenied,
  getRetentionPolicies: () => ({ synthetic_policy: { retention_days: 30 } }),
  getRetentionStats: async () => ({ synthetic: 0 }),
  identifyExpiredData: async () => [],
  sendRetentionNotifications: async () => []
};
const retentionJob = {
  start() { effects.jobStart += 1; throw Error('UNSAFE_JOB_START_CALLED'); },
  stop() { effects.jobStop += 1; },
  getStatus() { return { isRunning: false, hasCleanupInterval: false, hasNotificationInterval: false }; },
  performImmediateCleanup: deleteDenied
};
const backupService = {
  assertLegacyBackupAvailable: retiredError,
  verifyBackupIntegrity() { effects.backupRead++; throw Error('BACKUP_FILE_READ_CALLED'); },
  getBackupConfig: () => ({ backupDir: '/tmp/synthetic-backups' }),
  getBackupStats: async () => ({}),
  getBackupList: async () => []
};
const backupJob = {
  start: () => { effects.jobStart++; },
  stop: () => { effects.jobStop++; },
  getStatus: () => ({ isRunning: false })
};
Module._load = function mockedAdminDependencies(request, parent, isMain) {
  if (parent && (parent.filename === retentionRoute || parent.filename === backupRoute)) {
    if (request === '../../middleware/auth') return { verifyToken: authenticate, requireAdmin };
    if (request === '../../services/dataRetentionService') return retentionService;
    if (request === '../../jobs/dataRetentionJob') return retentionJob;
    if (request === '../../services/backupService') return backupService;
    if (request === '../../jobs/backupJob') return backupJob;
  }
  return originalLoad.apply(this, arguments);
};
let retentionRouter, backupRouter;
try {
  delete require.cache[retentionRoute];
  delete require.cache[backupRoute];
  retentionRouter = require(retentionRoute);
  backupRouter = require(backupRoute);
} finally {
  Module._load = originalLoad;
  for (const [filename, cached] of previous) {
    delete require.cache[filename];
    if (cached) require.cache[filename] = cached;
  }
}
const app = express();
app.use(express.json());
app.use('/api/admin/data-retention', retentionRouter);
app.use('/api/admin/backup', backupRouter);
const server = http.createServer(app);
let origin;
async function call(method, uri, token, body) {
  if (!origin) {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
  }
  return fetch(origin + uri, {
    method,
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}
after(async () => { if (server.listening) await new Promise(resolve => server.close(resolve)); });
const frozen = () => ({ ...effects });

const destructive = [
  ['DELETE', '/api/admin/data-retention/cleanup/synthetic-user'],
  ['POST', '/api/admin/data-retention/cleanup-all'],
  ['POST', '/api/admin/data-retention/cleanup/immediate'],
  ['POST', '/api/admin/data-retention/job/start']
];
test('all four destructive retention routes require Admin and return 410/no-store without any I/O', async () => {
  const baseline = frozen();
  for (const [method, uri] of destructive) {
    const body = { dataTypes: ['users'], confirm: 'DELETE' };
    assert.equal((await call(method, uri, null, body)).status, 401, uri + ' no token');
    assert.equal((await call(method, uri, 'synthetic-user', body)).status, 403, uri + ' non-admin');
    const res = await call(method, uri, 'synthetic-admin', body);
    assert.equal(res.status, 410, uri + ' Admin');
    assert.match(res.headers.get('cache-control') || '', /no-store/);
    const json = await res.json();
    assert.equal(json.error, 'RETENTION_LEGACY_CLEANUP_RETIRED');
  }
  assert.deepEqual(effects, baseline, 'no job start and zero destructive service calls');
});

test('backup legacy verify never reaches path.join, filesystem or private backup bytes', async () => {
  const baseline = frozen();
  for (const uri of [
    '/api/admin/backup/verify/example.json',
    '/api/admin/backup/verify/%2e%2e%2fprivate-file'
  ]) {
    assert.equal((await call('GET', uri, null)).status, 401);
    assert.equal((await call('GET', uri, 'synthetic-user')).status, 403);
    const res = await call('GET', uri, 'synthetic-admin');
    assert.equal(res.status, 410);
    assert.match(res.headers.get('cache-control') || '', /no-store/);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'LEGACY_APP_BACKUP_RETIRED');
  }
  assert.deepEqual(effects, baseline);
});

test('Admin can still read policies/status and STOP the retention job without destructive calls', async () => {
  const baseline = frozen();
  const res = await call('GET', '/api/admin/data-retention/policies', 'synthetic-admin');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.total_policies, 1);
  assert.equal((await call('GET', '/api/admin/data-retention/job/status', 'synthetic-admin')).status, 200);
  const stop = await call('POST', '/api/admin/data-retention/job/stop', 'synthetic-admin');
  assert.equal(stop.status, 200);
  assert.equal(effects.jobStop, baseline.jobStop + 1);
  assert.equal(effects.jobStart, baseline.jobStart);
  assert.equal(effects.deletion, baseline.deletion);
  assert.equal(effects.backupRead, baseline.backupRead);
});

test('app bootstrap cannot schedule legacy retention from ENABLE_DATA_RETENTION alone', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  assert.match(appSource, /Legacy RP-10 retention job retired/);
  assert.doesNotMatch(appSource, /dataRetentionJob\.start\s*\(/);
});

test('Admin retention UI cannot start or trigger destructive legacy cleanup', () => {
  const ui = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/DataRetention.tsx'), 'utf8');
  assert.doesNotMatch(ui, /\/admin\/data-retention\/(?:job\/start|cleanup\/immediate)/);
  assert.match(ui, /Avvio sospeso/);
  assert.match(ui, /pulizia legacy è sospesa/i);
});
