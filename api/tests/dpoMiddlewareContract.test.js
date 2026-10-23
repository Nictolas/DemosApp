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

let requireDpo;
try {
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === middlewarePath && request === './auth') {
      return { pool: fakePool };
    }
    return load.apply(this, arguments);
  };
  delete require.cache[middlewarePath];
  ({ requireDpo } = require(middlewarePath));
} finally {
  Module._load = load;
}

async function exercise(user) {
  const result = { status: 200, body: null, next: false };
  const res = {
    status(n) { result.status = n; return this; },
    json(body) { result.body = body; return this; }
  };
  await requireDpo({ user }, res, () => { result.next = true; });
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
