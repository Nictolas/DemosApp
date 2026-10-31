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


test('RP-10: monitoring and logging cleanup routes never succeed without approved retention', async () => {
  for (const file of ['monitoring', 'logging']) {
    for (const enabled of [false, true]) {
      let calls = 0;
      const handlers = new Map();
      const router = {
        use() {}, get() {}, put() {}, delete() {}, patch() {},
        post(route, ...fn) { handlers.set(route, fn[fn.length - 1]); }
      };
      const dependencies = {
        express: { Router: () => router },
        '../../middleware/auth': { verifyToken() {}, requireAdmin() {}, pool: {} },
        '../../middleware/auditMiddleware': { auditMiddleware() {} },
        '../../services/performanceMonitor': { cleanupOldMetrics: async () => { calls++; return 2; } },
        '../../services/performanceOptimizer': { stop() {} },
        '../../services/healthCheckService': { cleanupHealthHistory: async () => { calls++; return 3; } },
        '../../services/centralizedLogger': { cleanupOldLogs: async () => { calls++; return 0; } },
        '../../utils/axiomQueryHelper': { queryAxiom() {}, getCentralizedLogs() {} },
        '../../services/redisCache': {},
        '../../services/requestMetrics': {},
        child_process: { execFile() {} },
        util: { promisify: () => async () => {} },
        path: require('node:path')
      };
      const src = fs.readFileSync(path.join(__dirname, '../routes/admin/' + file + '.js'), 'utf8');
      new Function('require', 'module', 'console', 'process', src)(name => {
        if (Object.hasOwn(dependencies, name)) return dependencies[name];
        throw new Error('Unexpected dependency: ' + name);
      }, { exports: {} }, { error() {}, warn() {}, log() {} },
      { env: { AXIOM_ENABLED: enabled ? 'true' : 'false' } });
      const handler = handlers.get('/cleanup');
      assert.equal(typeof handler, 'function', file);
      for (const days of [30, -1, 'unapproved']) {
        const res = {
          statusCode: 200,
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; }
        };
        await handler({ body: { retentionDays: days } }, res);
        assert.equal(res.statusCode, 409, file);
        assert.deepEqual(res.body, {
          success: false,
          error: file === 'monitoring'
            ? 'RETENTION_POLICY_NOT_APPROVED' : 'LOG_RETENTION_POLICY_NOT_APPROVED'
        }, file);
      }
      assert.equal(calls, 0, file);
    }
  }
});

test('RP-10: direct metrics, health and logging cleanup methods reject before SQL', async () => {
  for (const [filename, method] of [
    ['performanceMonitor', 'cleanupOldMetrics'],
    ['healthCheckService', 'cleanupHealthHistory'],
    ['centralizedLogger', 'cleanupOldLogs']
  ]) {
    const src = fs.readFileSync(path.join(__dirname, '../services/' + filename + '.js'), 'utf8');
    for (const axiom of [false, true]) {
      let queries = 0;
      const fakeProcess = { env: {
        AXIOM_ENABLED: axiom ? 'true' : 'false',
        LOG_TO_FILE: 'false', LOG_TO_DATABASE: 'false'
      } };
      const dependencies = {
        '../middleware/auth': { pool: { query: async () => { queries++; throw new Error('UNEXPECTED_SQL'); } } },
        './performanceMonitor': {},
        './centralizedLogger': {},
        '../utils/logPrivacy': {
          sanitizeLogMeta: value => value,
          minimizeOperationalPath: value => value,
          safeDiagnosticCode: value => value
        },
        '../utils/logEventPolicy': { normalizeLevel: () => 2, shouldWriteLogEvent: () => true },
        '../utils/logDeliveryFailureReporter': { createFailureReporter: () => () => {} },
        '@axiomhq/axiom-node': {}
      };
      const wrapped = filename === 'performanceMonitor'
        ? src : 'const process = __mockProcess;\n' + src;
      const mod = { exports: {} };
      new Function('require', 'module', 'console', '__dirname', '__mockProcess', wrapped)(name => {
        if (Object.hasOwn(dependencies, name)) return dependencies[name];
        if (name === 'process') return fakeProcess;
        if (['os','fs','path','child_process','util'].includes(name)) return require(name);
        throw new Error('Unexpected dependency: ' + name);
      }, mod, { error() {}, warn() {}, log() {} },
      path.join(__dirname, '../services'), fakeProcess);
      assert.equal(typeof mod.exports[method], 'function', filename);
      for (const days of [30, -1, 'unapproved']) {
        await assert.rejects(
          () => mod.exports[method](days),
          error => error?.code === (filename === 'centralizedLogger'
            ? 'LOG_RETENTION_POLICY_NOT_APPROVED' : 'RETENTION_POLICY_NOT_APPROVED')
            && error?.statusCode === 409,
          filename
        );
      }
      assert.equal(queries, 0, filename);
    }
  }
});


test('retention destructive routes deny anonymous and non-admin requests before service calls', async () => {
  const authSource = fs.readFileSync(path.join(__dirname, '../middleware/auth.js'), 'utf8');
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/admin/data-retention.js'), 'utf8');
  const syntheticPool = {};
  let subjectLookups = 0;
  let currentIsAdmin = false;
  let destructiveCalls = 0;
  const authModule = { exports: {} };

  new Function('require', 'module', 'console', 'process', authSource)(
    (name) => {
      if (name === '../utils/jwt') {
        return { verifyAccessToken: () => ({ userId: 'synthetic-account', jti: 'synthetic-session' }) };
      }
      if (name === '../config/database') return { getPool: () => syntheticPool };
      if (name === '../services/redisCache') return { isEnabled: () => false };
      if (name === '../config/cacheKeys') {
        return { keys: { authUser: (id) => id }, ttl: { authUser: 0 } };
      }
      if (name === '../services/accountCapabilitiesService') {
        return {
          getAccountSubject: async (pool, id) => {
            assert.equal(pool, syntheticPool);
            assert.equal(id, 'synthetic-account');
            subjectLookups++;
            return {
              id,
              status: 'a',
              legacyRole: currentIsAdmin ? 'A' : 'U',
              capabilities: {
                accountType: 'p',
                isAdmin: currentIsAdmin,
                isActivist: false,
                isCandidate: false,
                isPolitician: false
              }
            };
          }
        };
      }
      throw new Error('Unexpected auth dependency: ' + name);
    },
    authModule,
    { log() {}, error() {} },
    { env: { NODE_ENV: 'production' } }
  );

  const middleware = [];
  const routes = new Map();
  const router = {
    use(handler) { middleware.push(handler); },
    get() {},
    delete(route, handler) { routes.set('DELETE ' + route, handler); },
    post(route, handler) { routes.set('POST ' + route, handler); }
  };
  const blockedOperation = async () => {
    destructiveCalls++;
    throw new Error('SYNTHETIC_DESTRUCTIVE_PATH_MUST_NOT_RUN');
  };
  const routeModule = { exports: {} };
  new Function('require', 'module', 'console', routeSource)(
    (name) => {
      if (name === 'express') return { Router: () => router };
      if (name === '../../middleware/auth') return authModule.exports;
      if (name === '../../services/dataRetentionService') {
        return {
          assertRetentionPolicyApproved: blockedOperation,
          deleteExpiredData: blockedOperation,
          deleteAllExpiredData: blockedOperation
        };
      }
      if (name === '../../jobs/dataRetentionJob') {
        return { start: blockedOperation, performImmediateCleanup: blockedOperation };
      }
      throw new Error('Unexpected route dependency: ' + name);
    },
    routeModule,
    { warn() {}, error() {} }
  );

  assert.deepEqual(middleware, [
    authModule.exports.verifyToken,
    authModule.exports.requireAdmin
  ], 'both real auth guards must protect every retention route');

  const endpoints = [
    'DELETE /cleanup/:userId',
    'POST /cleanup-all',
    'POST /job/start',
    'POST /cleanup/immediate'
  ];
  async function dispatch(endpoint, authorization) {
    const req = {
      headers: authorization ? { authorization } : {},
      body: {},
      params: { userId: 'synthetic-target' },
      url: '/api/admin/data-retention'
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    for (const guard of middleware) {
      let proceeded = false;
      await guard(req, res, () => { proceeded = true; });
      if (!proceeded) return res;
    }
    const handler = routes.get(endpoint);
    assert.equal(typeof handler, 'function', endpoint);
    await handler(req, res);
    return res;
  }

  for (const endpoint of endpoints) {
    const unauthenticated = await dispatch(endpoint);
    assert.equal(unauthenticated.statusCode, 401, endpoint);
    assert.equal(unauthenticated.body.success, false, endpoint);

    currentIsAdmin = false;
    const reader = await dispatch(endpoint, 'Bearer synthetic-valid');
    assert.equal(reader.statusCode, 403, endpoint);
    assert.equal(reader.body.error, 'Accesso negato', endpoint);
  }
  assert.equal(subjectLookups, endpoints.length, 'anonymous calls must not query account');
  assert.equal(destructiveCalls, 0, 'denied requests must never reach retention operations');
});


test('retention UI exposes only read-only status and emergency stop during RP-10 block', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../client/src/pages/DataRetention.tsx'), 'utf8');
  // Contract-level regression: this is a source check, not a rendered browser test.
  const requests = [...source.matchAll(/apiRequest\(\s*['"]([A-Z]+)['"]\s*,\s*['"]([^'"]+)['"]/g)]
    .map(([, method, endpoint]) => [method, endpoint]);
  assert.deepEqual(requests, [
    ['GET', '/admin/data-retention/job/status'],
    ['POST', '/admin/data-retention/job/stop']
  ], 'the screen must never call unapproved cleanup, scheduler-start, or legacy statistics endpoints');
  assert.match(source, /jobStatus\.isRunning && \(/, 'only show stop if job is running');
  assert.match(source, /onClick=\{handleStopJob\}/);
  assert.match(source, /Politica di retention non approvata/);
  assert.doesNotMatch(source, /handleStartJob|handleImmediateCleanup/);
  assert.doesNotMatch(source, /Il sistema di data retention cancella automaticamente/);
});
