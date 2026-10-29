'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../routes/admin/audit-dashboard.js'), 'utf8');

async function invokeCleanup({ axiomEnabled, cleanupOldLogs }) {
  const routes = new Map();
  const diagnostics = [];
  let cleanupCalls = 0;
  const router = {
    use() {},
    get() {},
    post(route, handler) { routes.set(route, handler); }
  };
  const requireStub = (name) => {
    if (name === 'express') return { Router: () => router };
    if (name === '../../middleware/auth') return { verifyToken() {}, requireAdmin() {}, pool: {} };
    if (name === '../../middleware/validation') return { validateInput() {} };
    if (name === '../../services/auditService') {
      return { cleanupOldLogs: async (...args) => {
        cleanupCalls++;
        return cleanupOldLogs(...args);
      } };
    }
    if (name === '../../utils/dateUtils') {
      return { formatAuditLogDate() {}, formatSecurityViolationDate() {} };
    }
    if (name === '../../utils/axiomQueryHelper') {
      return { getAuditLogs() {}, queryAxiom() {} };
    }
    throw new Error('Unexpected dependency: ' + name);
  };
  const isolatedModule = { exports: {} };
  new Function('require', 'module', 'console', 'process', source)(
    requireStub,
    isolatedModule,
    { error: (...args) => diagnostics.push(args.join(' ')) },
    { env: { AXIOM_ENABLED: axiomEnabled ? 'true' : 'false' } }
  );
  const handler = routes.get('/cleanup');
  assert.equal(typeof handler, 'function');
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await handler({ body: { daysToKeep: 30 } }, res);
  return { res, diagnostics, cleanupCalls };
}

test('Axiom/B2 archive cannot be reported cleaned by an endpoint that performs no cleanup', async () => {
  const result = await invokeCleanup({
    axiomEnabled: true,
    cleanupOldLogs: async () => { throw new Error('must never be called'); }
  });
  assert.equal(result.res.statusCode, 409);
  assert.equal(result.res.body.success, false);
  assert.equal(result.res.body.deleted_count, 0);
  assert.equal(result.res.body.error, 'AUDIT_RETENTION_PROVIDER_REVIEW_REQUIRED');
  assert.equal(result.cleanupCalls, 0);
});

test('unapproved local audit retention remains fail-closed and never exposes raw exceptions', async () => {
  const sensitive = 'SYNTHETIC_SECRET_NEVER_RETURN';
  const result = await invokeCleanup({
    axiomEnabled: false,
    cleanupOldLogs: async () => {
      throw Object.assign(new Error(sensitive), { code: 'AUDIT_RETENTION_POLICY_NOT_APPROVED' });
    }
  });
  assert.equal(result.res.statusCode, 409);
  assert.equal(result.res.body.error, 'AUDIT_RETENTION_POLICY_NOT_APPROVED');
  assert.equal(result.res.body.success, false);
  assert.equal(result.cleanupCalls, 1);
  assert.doesNotMatch(JSON.stringify(result.res.body) + result.diagnostics.join(' '), /SYNTHETIC_SECRET/);
});

test('unexpected audit cleanup failures return a stable generic 500 without leaking SQL/provider details', async () => {
  const result = await invokeCleanup({
    axiomEnabled: false,
    cleanupOldLogs: async () => { throw new Error('SYNTHETIC_SECRET_SQL_QUERY'); }
  });
  assert.equal(result.res.statusCode, 500);
  assert.equal(result.res.body.error, 'AUDIT_CLEANUP_FAILED');
  assert.equal(result.res.body.success, false);
  assert.doesNotMatch(JSON.stringify(result.res.body) + result.diagnostics.join(' '), /SYNTHETIC_SECRET/);
});

test('audit dashboard read failures never disclose raw provider exceptions in HTTP or logs', async () => {
  const secret = 'SYNTHETIC_AUDIT_SQL_PROVIDER_DETAIL';
  const routes = new Map();
  const diagnostics = [];
  const router = {
    use() {},
    get(route, handler) { routes.set(route, handler); },
    post() {}
  };
  const requireStub = (name) => {
    if (name === 'express') return { Router: () => router };
    if (name === '../../middleware/auth') return {
      verifyToken() {}, requireAdmin() {},
      pool: { query: async () => { throw new Error(secret); } }
    };
    if (name === '../../middleware/validation') return { validateInput() {} };
    if (name === '../../services/auditService') return {
      getUserAuditLogs: async () => { throw new Error(secret); }
    };
    if (name === '../../utils/dateUtils') return {
      formatAuditLogDate() {}, formatSecurityViolationDate() {}
    };
    if (name === '../../utils/axiomQueryHelper') return {
      getAuditLogs: async () => { throw new Error(secret); },
      queryAxiom() {}
    };
    throw new Error('Unexpected dependency: ' + name);
  };
  const isolatedModule = { exports: {} };
  new Function('require', 'module', 'console', 'process', source)(
    requireStub, isolatedModule,
    { error: (...args) => diagnostics.push(args.join(' ')) },
    { env: { AXIOM_ENABLED: 'true' } }
  );
  for (const route of ['/stats', '/logs', '/user/:userId', '/suspicious', '/violations', '/performance']) {
    const handler = routes.get(route);
    assert.equal(typeof handler, 'function', route);
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await handler({ query: {}, params: { userId: 'synthetic-user' } }, res);
    assert.equal(res.statusCode, 500, route);
    assert.equal(res.body.success, false, route);
    assert.doesNotMatch(JSON.stringify(res.body) + diagnostics.join(' '), /SYNTHETIC_AUDIT_SQL_PROVIDER_DETAIL/, route);
  }
});

test('audit dashboard and service avoid logging raw provider error objects', () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, '../services/auditService.js'), 'utf8');
  assert.doesNotMatch(source, /console\.error\([^\n]*,\s*error\)/);
  assert.doesNotMatch(source, /message:\s*error\.message/);
  assert.doesNotMatch(serviceSource, /console\.error\([^\n]*,\s*error\)/);
});


test('legacy retention refuses destructive methods before any SQL or audit writes', async () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, '../services/dataRetentionService.js'), 'utf8');
  let dbCalls = 0;
  let auditCalls = 0;
  const moduleStub = { exports: {} };
  new Function('require', 'module', 'console', serviceSource)((name) => {
    if (name === '../middleware/auth') return { pool: { query: async () => { dbCalls++; throw new Error('UNEXPECTED_DB_QUERY'); } } };
    if (name === './auditService') return { logAction: async () => { auditCalls++; } };
    throw new Error('Unexpected dependency: ' + name);
  }, moduleStub, { log() {}, error() {} });
  const service = moduleStub.exports;
  for (const operation of [
    () => service.deleteExpiredData('synthetic-user'),
    () => service.deleteAllExpiredData(),
    () => service.performFullCleanup()
  ]) {
    await assert.rejects(operation, error => error.code === 'RETENTION_POLICY_NOT_APPROVED' && error.statusCode === 409);
  }
  assert.equal(dbCalls, 0);
  assert.equal(auditCalls, 0);
});

test('legacy admin retention cleanup endpoints and job start return 409 before scheduling', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/admin/data-retention.js'), 'utf8');
  const routes = new Map();
  let mutationCalls = 0;
  const blocked = () => {
    const error = new Error('RETENTION_POLICY_NOT_APPROVED');
    error.code = 'RETENTION_POLICY_NOT_APPROVED';
    throw error;
  };
  const router = {
    use() {}, get() {},
    delete(route, handler) { routes.set('DELETE ' + route, handler); },
    post(route, handler) { routes.set('POST ' + route, handler); }
  };
  const moduleStub = { exports: {} };
  new Function('require', 'module', 'console', source)((name) => {
    if (name === 'express') return { Router: () => router };
    if (name === '../../middleware/auth') return { verifyToken() {}, requireAdmin() {} };
    if (name === '../../services/dataRetentionService') return {
      assertRetentionPolicyApproved: blocked,
      deleteExpiredData: () => { mutationCalls++; blocked(); },
      deleteAllExpiredData: () => { mutationCalls++; blocked(); }
    };
    if (name === '../../jobs/dataRetentionJob') return {
      start: () => { mutationCalls++; },
      performImmediateCleanup: () => { mutationCalls++; blocked(); }
    };
    throw new Error('Unexpected dependency: ' + name);
  }, moduleStub, { warn() {}, error() {} });
  for (const route of [
    'DELETE /cleanup/:userId', 'POST /cleanup-all',
    'POST /job/start', 'POST /cleanup/immediate'
  ]) {
    const handler = routes.get(route);
    assert.equal(typeof handler, 'function', route);
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await handler({ body: {}, params: { userId: 'synthetic-user' } }, res);
    assert.equal(res.statusCode, 409, route);
    assert.equal(res.body.success, false, route);
    assert.equal(res.body.error, 'RETENTION_POLICY_NOT_APPROVED', route);
  }
  assert.equal(mutationCalls, 3);
});


test('RP-10 blocks both security-event cleanup endpoints before any SQL', async () => {
  let dbCalls = 0;
  let serviceCalls = 0;
  const pool = { query: async () => { dbCalls++; throw new Error('SYNTHETIC_DB_SHOULD_NOT_BE_CALLED'); } };
  function loadCleanupRoute(filename) {
    const routes = new Map();
    const router = {
      use() {}, get() {},
      post(route, handler) { routes.set(route, handler); }
    };
    const moduleStub = { exports: {} };
    const code = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    new Function('require', 'module', 'console', code)((name) => {
      if (name === 'express') return { Router: () => router };
      if (name === '../../middleware/auth') return { verifyToken() {}, requireAdmin() {}, pool };
      if (name === '../../middleware/auditMiddleware') return { auditMiddleware() {} };
      if (name === '../../services/rateLimitService') {
        return { cleanupOldViolations: async () => { serviceCalls++; throw new Error('SYNTHETIC_SERVICE_SHOULD_NOT_BE_CALLED'); } };
      }
      throw new Error('Unexpected dependency: ' + name);
    }, moduleStub, { error() {}, warn() {}, log() {} });
    return routes.get('/cleanup');
  }
  for (const file of ['routes/admin/validation.js', 'routes/admin/rate-limiting.js']) {
    const handler = loadCleanupRoute(file);
    assert.equal(typeof handler, 'function', file);
    for (const retentionDays of [30, 0, -1, 'invalid']) {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
      };
      await handler({ body: { retentionDays } }, res);
      assert.equal(res.statusCode, 409, file);
      assert.deepEqual(res.body, { success: false, error: 'RETENTION_POLICY_NOT_APPROVED' }, file);
    }
  }
  assert.equal(dbCalls, 0);
  assert.equal(serviceCalls, 0);
});

test('RP-10 blocks direct rate-limit service cleanup before querying SQL', async () => {
  const code = fs.readFileSync(path.join(__dirname, '../services/rateLimitService.js'), 'utf8');
  let dbCalls = 0;
  const moduleStub = { exports: {} };
  new Function('require', 'module', 'console', code)((name) => {
    if (name === '../middleware/auth') return {
      pool: { query: async () => { dbCalls++; throw new Error('SYNTHETIC_DB_SHOULD_NOT_BE_CALLED'); } }
    };
    throw new Error('Unexpected dependency: ' + name);
  }, moduleStub, { error() {}, log() {} });
  await assert.rejects(
    () => moduleStub.exports.cleanupOldViolations(30),
    error => error.code === 'RETENTION_POLICY_NOT_APPROVED' && error.statusCode === 409
  );
  assert.equal(dbCalls, 0);
});
