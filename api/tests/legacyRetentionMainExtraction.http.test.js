'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const routePath = require.resolve('../routes/admin/data-retention');
const effects = { deleteCalls: 0, starts: 0, stops: 0 };
const refuseDelete = () => { effects.deleteCalls++; throw Error('UNEXPECTED_DELETE'); };
const retentionService = {
  deleteExpiredData: refuseDelete,
  deleteAllExpiredData: refuseDelete,
  getRetentionPolicies: () => ({ synthetic: { retention_days: 30 } }),
  getRetentionStats: async () => ({}),
  identifyExpiredData: async () => [],
  sendRetentionNotifications: async () => { throw Error('UNEXPECTED_RETENTION_PII_SCAN'); }
};
const retentionJob = {
  start() { effects.starts++; throw Error('UNEXPECTED_JOB_START'); },
  stop() { effects.stops++; },
  getStatus: () => ({ isRunning: false }),
  performImmediateCleanup: refuseDelete
};
const auth = {
  verifyToken(req, res, next) {
    if (!req.headers.authorization) return res.status(401).json({ success: false });
    return next();
  },
  requireAdmin(req, res, next) {
    if (req.headers.authorization !== 'Bearer synthetic-admin') {
      return res.status(403).json({ success: false });
    }
    return next();
  }
};
const originalLoad = Module._load;
const previous = require.cache[routePath];
Module._load = function(request, parent, isMain) {
  if (parent?.filename === routePath) {
    if (request === '../../middleware/auth') return auth;
    if (request === '../../services/dataRetentionService') return retentionService;
    if (request === '../../jobs/dataRetentionJob') return retentionJob;
  }
  return originalLoad.apply(this, arguments);
};
let router;
try {
  delete require.cache[routePath];
  router = require(routePath);
} finally {
  Module._load = originalLoad;
  delete require.cache[routePath];
  if (previous) require.cache[routePath] = previous;
}

test('all four legacy retention writes fail closed for non-admin and Admin', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/data-retention', router);
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [method, route] of [
      ['DELETE', '/cleanup/synthetic-user'],
      ['POST', '/cleanup-all'],
      ['POST', '/cleanup/immediate'],
      ['POST', '/job/start']
    ]) {
      for (const [authHeader, expected] of [[null, 401],
        ['Bearer synthetic-user', 403], ['Bearer synthetic-admin', 410]]) {
        const res = await fetch(base + '/api/admin/data-retention' + route, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(authHeader ? { authorization: authHeader } : {})
          },
          body: JSON.stringify({ dataTypes: ['users'], confirm: 'DELETE' })
        });
        assert.equal(res.status, expected, method + ' ' + route + ': ' + authHeader);
        if (expected === 410) {
          assert.match(res.headers.get('cache-control') || '', /no-store/);
          assert.equal((await res.json()).error, 'RETENTION_LEGACY_CLEANUP_RETIRED');
        }
      }
    }
    assert.deepEqual(effects, { deleteCalls: 0, starts: 0, stops: 0 },
      'no destructive service or job started');
    assert.equal((await fetch(base + '/api/admin/data-retention/policies', {
      headers: {authorization: 'Bearer synthetic-admin'}
    })).status, 200);
    assert.equal((await fetch(base + '/api/admin/data-retention/job/status', {
      headers: {authorization: 'Bearer synthetic-admin'}
    })).status, 200);
    assert.equal((await fetch(base + '/api/admin/data-retention/job/stop', {
      method: 'POST', headers: {authorization: 'Bearer synthetic-admin'}
    })).status, 200);
    assert.deepEqual(effects, { deleteCalls: 0, starts: 0, stops: 1 });
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});

test('startup cannot silently re-enable unsafe cleanup from inherited env', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  assert.match(source, /Legacy RP-10 retention job retired/);
  assert.doesNotMatch(source, /dataRetentionJob\.start\s*\(/);
});

test('Admin retention UI does not expose the suspended cleanup actions', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/DataRetention.tsx'), 'utf8');
  assert.match(source, /Avvio sospeso/);
  assert.doesNotMatch(source, /\/admin\/data-retention\/(?:job\/start|cleanup\/immediate)/);
});


test('retired retention notifications require Admin then return 410 without PII extraction', async () => {
  const app=express();
  app.use('/api/admin/data-retention',router);
  const server=http.createServer(app);
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const base='http://127.0.0.1:'+server.address().port;
  try {
    for(const [authHeader,expected] of [
      [null,401],['Bearer synthetic-user',403],['Bearer synthetic-admin',410]
    ]) {
      const res=await fetch(base+'/api/admin/data-retention/notifications?daysBefore=30',{
        headers:authHeader?{authorization:authHeader}:{}
      });
      assert.equal(res.status,expected,'role '+(authHeader||'anonymous'));
      if(expected===410) {
        assert.match(res.headers.get('cache-control')||'',/no-store/);
        assert.equal((await res.json()).error,'RETENTION_LEGACY_CLEANUP_RETIRED');
      }
    }
    const policies=await fetch(base+'/api/admin/data-retention/policies',{
      headers:{authorization:'Bearer synthetic-admin'}
    });
    assert.equal(policies.status,200);
    const json=await policies.json();
    assert.equal(json.data.policy_status,'legacy_unreviewed');
    assert.equal(json.data.automated_cleanup_enabled,false);
    assert.equal(json.data.valid_legal_basis_confirmed,false);
  } finally {
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});
