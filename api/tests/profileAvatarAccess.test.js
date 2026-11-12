const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../routes/users/profile.js'), 'utf8');
const start = source.indexOf("router.post('/me/avatar'");
const end = source.indexOf('// PUT /api/users/me', start);
assert.ok(start >= 0 && end > start);
const routeSource = source.slice(start, end);

async function invokeAvatarRoute(capabilities) {
  let handler;
  let connected = 0;
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.startsWith('UPDATE users')) return { rows: [{ avatar_config: '{"skinColor":"#ffffff"}' }] };
      return { rows: [] };
    },
    release() {},
  };
  const sandbox = {
    router: { post: (_path, ...handlers) => { handler = handlers.at(-1); } },
    verifyToken: () => {},
    userDataAuditMiddleware: () => {},
    pool: { connect: async () => { connected++; return db; } },
    console: { log() {}, error() {} },
  };
  vm.runInNewContext(routeSource, sandbox);
  let status = 200, body;
  const response = {
    status(value) { status = value; return this; },
    json(data) { body = data; return this; },
  };
  await handler({
    user: { id: 'synthetic-only', ...capabilities },
    body: { avatar_config: '{"skinColor":"#ffffff"}' },
  }, response);
  return { status, body, connected, queries };
}

test('electors and DPO-only accounts cannot create avatars, even by direct POST', async () => {
  for (const actor of [
    { role: 'E' },
    { role: 'DPO', isDpo: true },
    { role: 'AD', isAdmin: false },
    { role: 'A', isActivist: true },
    { role: 'O' },
    { role: 'I' },
  ]) {
    const result = await invokeAvatarRoute(actor);
    assert.equal(result.status, 403, actor.role);
    assert.equal(result.body.error, 'AVATAR_NOT_ALLOWED');
    assert.equal(result.connected, 0, actor.role + ' must never open a database transaction');
    assert.equal(result.queries.length, 0);
  }
});

test('verified Admin, politician and candidate retain avatar editor writes', async () => {
  for (const actor of [
    { role: 'AD', isAdmin: true },
    { role: 'P', isPolitician: true },
    { role: 'C', isCandidate: true },
    { role: 'CP', isPolitician: true, isCandidate: true },
  ]) {
    const result = await invokeAvatarRoute(actor);
    assert.equal(result.status, 200, actor.role);
    assert.equal(result.body.success, true);
    assert.equal(result.connected, 1);
    assert.ok(result.queries.some(entry => entry.sql.startsWith('UPDATE users')));
    assert.ok(result.queries.some(entry => entry.sql.includes('INSERT INTO user_profile')));
  }
});
