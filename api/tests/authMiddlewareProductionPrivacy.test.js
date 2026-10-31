const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Isolate the middleware from production services; never connect to a real database.
function createProductionMiddleware({ verifyAccessToken, getAccountSubject } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../middleware/auth.js'), 'utf8');
  const errors = [];
  const module = { exports: {} };
  const dependencies = {
    '../utils/jwt': {
      verifyAccessToken: verifyAccessToken || (() => ({ userId: 'synthetic-user' }))
    },
    '../config/database': { getPool: () => ({}) },
    '../services/redisCache': { isEnabled: () => false },
    '../config/cacheKeys': {
      keys: { authUser: (id) => id },
      ttl: { authUser: 0 }
    },
    '../services/accountCapabilitiesService': {
      getAccountSubject: getAccountSubject || (async () => ({
        id: 'synthetic-user',
        status: 'a',
        legacyRole: 'E',
        capabilities: {
          accountType: 'P',
          isAdmin: false,
          isActivist: false,
          isCandidate: false,
          isPolitician: false
        }
      }))
    }
  };

  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) => {
      if (!Object.hasOwn(dependencies, name)) {
        throw new Error(`Unexpected dependency: ${name}`);
      }
      return dependencies[name];
    },
    process: { env: { NODE_ENV: 'production' } },
    console: {
      log() {},
      error: (...args) => errors.push(args.map(String).join(' '))
    }
  }, { filename: 'api/middleware/auth.js' });

  return { verifyToken: module.exports.verifyToken, errors };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('production middleware returns a generic 500 even without the global response sanitizer', async () => {
  const secret = 'private-inner-exception-value';
  const { verifyToken, errors } = createProductionMiddleware();
  const req = {
    url: '/api/private',
    get headers() {
      throw new Error(secret);
    }
  };
  const res = responseRecorder();

  await verifyToken(req, res, () => assert.fail('next should not run'));

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'Errore interno del server');
  assert.equal(Object.hasOwn(res.body, 'details'), false);
  assert.equal(JSON.stringify(res.body).includes(secret), false);
  assert.equal(errors.join(' ').includes(secret), false);
});

test('production JWT failure never logs exception details', async () => {
  const secret = 'private-jwt-error-value';
  const { verifyToken, errors } = createProductionMiddleware({
    verifyAccessToken: () => { throw new Error(secret); }
  });
  const res = responseRecorder();

  await verifyToken({
    url: '/api/private',
    headers: { authorization: 'Bearer synthetic-token' }
  }, res, () => assert.fail('next should not run'));

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Token non valido');
  assert.equal(errors.join(' ').includes(secret), false);
});

test('production database failure never logs underlying error details', async () => {
  const secret = 'private-database-error-value';
  const { verifyToken, errors } = createProductionMiddleware({
    getAccountSubject: async () => { throw new Error(secret); }
  });
  const res = responseRecorder();

  await verifyToken({
    url: '/api/private',
    headers: { authorization: 'Bearer synthetic-token' }
  }, res, () => assert.fail('next should not run'));

  assert.ok(res.statusCode >= 400);
  assert.equal(JSON.stringify(res.body).includes(secret), false);
  assert.equal(errors.join(' ').includes(secret), false);
});

test('normal authenticated request still reaches the next handler', async () => {
  const { verifyToken } = createProductionMiddleware();
  const res = responseRecorder();
  let nextCalled = false;
  const req = {
    url: '/api/private',
    headers: { authorization: 'Bearer synthetic-token' }
  };

  await verifyToken(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 'synthetic-user');
  assert.equal(req.user.isAdmin, false);
  assert.equal(res.body, undefined);
});
