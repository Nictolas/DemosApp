const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const storePath = require.resolve(path.join(ROOT, 'services', 'identityVerificationStore.js'));
const middlewarePath = require.resolve(path.join(ROOT, 'middleware', 'civicIdentity.js'));

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function withIdentityLookup(getIdentityVerificationStatus, fn) {
  const originalStore = require.cache[storePath];
  const originalMiddleware = require.cache[middlewarePath];

  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: { getIdentityVerificationStatus },
  };
  delete require.cache[middlewarePath];

  try {
    const { requireVerifiedCivicIdentity } = require(middlewarePath);
    await fn(requireVerifiedCivicIdentity);
  } finally {
    delete require.cache[middlewarePath];
    if (originalMiddleware) require.cache[middlewarePath] = originalMiddleware;
    if (originalStore) require.cache[storePath] = originalStore;
    else delete require.cache[storePath];
  }
}

test('admin: civic write proceeds without consulting CIE persistence', async () => {
  let lookupCalls = 0;

  await withIdentityLookup(async () => {
    lookupCalls += 1;
    throw new Error('identity_verifications missing');
  }, async (requireVerifiedCivicIdentity) => {
    const req = { userId: 'admin-user', user: { isAdmin: true } };
    const res = makeResponse();
    let nextCalled = false;

    await requireVerifiedCivicIdentity(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(lookupCalls, 0);
    assert.equal(req.civicIdentity?.temporaryAdminException, true);
    assert.equal(req.civicIdentity?.provider, 'ADMIN_TEMPORARY_EXCEPTION');
  });
});

test('non-admin: identity persistence failure remains fail-closed', async () => {
  await withIdentityLookup(async () => {
    throw new Error('identity_verifications missing');
  }, async (requireVerifiedCivicIdentity) => {
    const req = { userId: 'regular-user', user: { isAdmin: false } };
    const res = makeResponse();
    let nextCalled = false;

    await requireVerifiedCivicIdentity(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body?.code, 'CIVIC_IDENTITY_CHECK_UNAVAILABLE');
  });
});
