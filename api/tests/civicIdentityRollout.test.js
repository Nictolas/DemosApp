'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const storePath = require.resolve(path.join(ROOT, 'services', 'identityVerificationStore.js'));
const middlewarePath = require.resolve(path.join(ROOT, 'middleware', 'civicIdentity.js'));
const {
  CIVIC_IDENTITY_MODES,
  getCivicIdentityMode,
  isCieRequiredForCivicActions,
} = require('../services/civicIdentityPolicy');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

async function withLookup(statusLookup, run) {
  const originalStore = require.cache[storePath];
  const originalMiddleware = require.cache[middlewarePath];
  require.cache[storePath] = {
    id: storePath, filename: storePath, loaded: true,
    exports: { getIdentityVerificationStatus: statusLookup },
  };
  delete require.cache[middlewarePath];
  try {
    const { requireVerifiedCivicIdentity } = require(middlewarePath);
    await run(requireVerifiedCivicIdentity);
  } finally {
    delete require.cache[middlewarePath];
    if (originalMiddleware) require.cache[middlewarePath] = originalMiddleware;
    if (originalStore) require.cache[storePath] = originalStore;
    else delete require.cache[storePath];
  }
}

async function withMode(mode, run) {
  const saved = process.env.DEMOS_CIVIC_IDENTITY_MODE;
  if (mode === undefined) delete process.env.DEMOS_CIVIC_IDENTITY_MODE;
  else process.env.DEMOS_CIVIC_IDENTITY_MODE = mode;
  try { await run(); }
  finally {
    if (saved === undefined) delete process.env.DEMOS_CIVIC_IDENTITY_MODE;
    else process.env.DEMOS_CIVIC_IDENTITY_MODE = saved;
  }
}

test('CIE policy is progressive by default and requires explicit strict switch', () => {
  assert.equal(getCivicIdentityMode({}), CIVIC_IDENTITY_MODES.PROGRESSIVE);
  assert.equal(isCieRequiredForCivicActions({}), false);
  assert.equal(getCivicIdentityMode({ DEMOS_CIVIC_IDENTITY_MODE: 'cie_required' }), CIVIC_IDENTITY_MODES.CIE_REQUIRED);
  assert.equal(isCieRequiredForCivicActions({ DEMOS_CIVIC_IDENTITY_MODE: 'cie_required' }), true);
  assert.throws(() => getCivicIdentityMode({ DEMOS_CIVIC_IDENTITY_MODE: 'whatever' }), /non valido/);
});

test('progressive: authenticated regular user can choose without CIE and lookup is skipped', async () => {
  await withMode('progressive', async () => {
    let calls = 0;
    await withLookup(async () => { calls++; throw Error('should not inspect CIE'); }, async guard => {
      const req = { userId: 'regular-user', user: { isAdmin: false } };
      const res = response();
      let passed = false;
      await guard(req, res, () => { passed = true; });
      assert.equal(passed, true);
      assert.equal(calls, 0);
      assert.equal(req.civicIdentity.verified, false);
      assert.equal(req.civicIdentity.requirementDeferred, true);
      assert.equal(req.civicIdentity.provider, null);
    });
  });
});

test('even in progressive mode the civic action is restricted to authenticated users', async () => {
  await withMode('progressive', async () => withLookup(async () => ({ verified: false }), async guard => {
    const res = response();
    let called = false;
    await guard({ user: { isAdmin: false } }, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'AUTH_REQUIRED');
  }));
});

test('cie_required: an unverified user is blocked, verified CIE is permitted', async () => {
  await withMode('cie_required', async () => withLookup(
    async userId => userId === 'verified'
      ? { verified: true, provider: 'CIE' }
      : { verified: false, provider: null },
    async guard => {
      const noCie = response();
      let firstPass = false;
      await guard({ userId: 'unverified', user: {} }, noCie, () => { firstPass = true; });
      assert.equal(firstPass, false);
      assert.equal(noCie.statusCode, 403);
      assert.equal(noCie.body.code, 'CIVIC_IDENTITY_CIE_REQUIRED');

      const yesCie = response();
      const req = { userId: 'verified', user: {} };
      let secondPass = false;
      await guard(req, yesCie, () => { secondPass = true; });
      assert.equal(secondPass, true);
      assert.equal(req.civicIdentity.verified, true);
      assert.equal(req.civicIdentity.provider, 'CIE');
    }
  ));
});

test('invalid policy rejects civic writes instead of silently switching to progressive', async () => {
  await withMode('unrecognized', async () => withLookup(
    async () => { throw Error('should not query'); },
    async guard => {
      const res = response();
      let passed = false;
      await guard({ userId: 'regular-user', user: {} }, res, () => { passed = true; });
      assert.equal(passed, false);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.code, 'CIVIC_IDENTITY_POLICY_INVALID');
    }
  ));
});
