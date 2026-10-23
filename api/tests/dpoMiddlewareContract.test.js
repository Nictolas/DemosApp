const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const middlewarePath = path.resolve(__dirname, '../middleware/dpoAccess.js');
const authPath = path.resolve(__dirname, '../middleware/auth.js');
const load = Module._load;
const records = [];
const fakePool = {
  async query(sql, params) {
    assert.match(sql, /SELECT is_dpo, is_admin, status FROM public\.users/);
    assert.equal(params.length, 1);
    if (params[0] === 'db-error') throw Error('synthetic');
    return { rows: records.filter((r) => r.id === params[0]) };
  }
};

let requireDpo, requirePrivacyOverviewAccess;
try {
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === middlewarePath && request === './auth') {
      return { pool: fakePool };
    }
    return load.apply(this, arguments);
  };
  delete require.cache[middlewarePath];
  ({ requireDpo, requirePrivacyOverviewAccess } = require(middlewarePath));
} finally {
  Module._load = load;
}

async function exercise(user, middleware = requireDpo) {
  const result = { status: 200, body: null, next: false };
  const res = {
    status(n) { result.status = n; return this; },
    json(body) { result.body = body; return this; }
  };
  const req = { user };
  await middleware(req, res, () => { result.next = true; });
  result.privacyOverviewRole = req.privacyOverviewRole;
  return result;
}

test('actual DPO middleware: denied user has no session', async () => {
  const v = await exercise(null);
  assert.equal(v.status, 401);
  assert.equal(v.next, false);
});

test('actual DPO middleware: app Admin cannot act as DPO', async () => {
  const v = await exercise({ id: 'admin', isAdmin: true });
  assert.equal(v.status, 403);
  assert.equal(v.next, false);
});

test('actual DPO middleware: active grant works, revocation takes effect', async () => {
  records.splice(0, records.length, { id: 'dpo', status: 'a', is_dpo: true, is_admin: false });
  assert.equal((await exercise({ id: 'dpo', isAdmin: false })).next, true);
  records[0].is_dpo = false;
  const denied = await exercise({ id: 'dpo', isAdmin: false });
  assert.equal(denied.status, 403);
  assert.equal(denied.next, false);
});

test('actual DPO middleware: DBA flag denies even if DPO flag is true', async () => {
  records.splice(0, records.length, { id: 'bad', status: 'a', is_dpo: true, is_admin: true });
  assert.equal((await exercise({ id: 'bad', isAdmin: false })).status, 403);
});

test('actual DPO middleware: fails closed on missing record', async () => {
  records.splice(0);
  assert.equal((await exercise({ id: 'missing', isAdmin: false })).status, 403);
});

test('actual DPO middleware: fails closed on DB error', async () => {
  const previous = console.error;
  console.error = () => {};
  try { assert.equal((await exercise({ id: 'db-error', isAdmin: false })).status, 503); }
  finally { console.error = previous; }
});

test('privacy overview: active Admin and DPO may read aggregates, no role elevation', async () => {
  records.splice(0, records.length,
    { id: 'admin', status: 'a', is_admin: true, is_dpo: false },
    { id: 'dpo', status: 'a', is_admin: false, is_dpo: true },
    { id: 'ordinary', status: 'a', is_admin: false, is_dpo: false },
    { id: 'inactive-admin', status: 'i', is_admin: true, is_dpo: false }
  );
  const admin = await exercise({ id: 'admin', isAdmin: true }, requirePrivacyOverviewAccess);
  assert.equal(admin.next, true);
  assert.equal(admin.privacyOverviewRole, 'Admin');
  const dpo = await exercise({ id: 'dpo', isAdmin: false }, requirePrivacyOverviewAccess);
  assert.equal(dpo.next, true);
  assert.equal(dpo.privacyOverviewRole, 'DPO');
  assert.equal((await exercise({ id: 'ordinary' }, requirePrivacyOverviewAccess)).status, 403);
  assert.equal((await exercise({ id: 'inactive-admin' }, requirePrivacyOverviewAccess)).status, 403);
  assert.equal((await exercise(null, requirePrivacyOverviewAccess)).status, 401);
  assert.equal((await exercise({ id: 'missing', isAdmin: true }, requirePrivacyOverviewAccess)).status, 403);

  // A forged/stale JWT Admin claim does not grant access without the DB flag.
  assert.equal((await exercise({ id: 'ordinary', isAdmin: true }, requirePrivacyOverviewAccess)).status, 403);
  records[0].is_admin = false;
  assert.equal((await exercise({ id: 'admin', isAdmin: true }, requirePrivacyOverviewAccess)).status, 403);
  const previous = console.error;
  console.error = () => {};
  try {
    assert.equal((await exercise({ id: 'db-error' }, requirePrivacyOverviewAccess)).status, 503);
  } finally {
    console.error = previous;
  }
});
