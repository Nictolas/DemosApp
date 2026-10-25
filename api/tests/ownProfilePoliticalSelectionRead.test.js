'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  PERSONAL_SELECTION_FIELDS,
  maskPoliticalSelectionsWithoutConsent,
} = require('../services/personalPoliticalSelectionVisibilityService');

const root = path.join(__dirname, '..');
const ids = ['rappresentante_europeo', 'rappresentante_camera',
  'rappresentante_senato', 'rappresentante_regionale',
  'rappresentante_comune', 'candidato_europeo', 'candidato_camera',
  'candidato_senato', 'candidato_regionale', 'candidato_comune'];
const source = {
  users: fs.readFileSync(path.join(root, 'routes/users/profile.js'), 'utf8'),
  auth: fs.readFileSync(path.join(root, 'routes/auth/profile.js'), 'utf8'),
};

function fixtureUser(role = 'E') {
  const user = {
    id: 'synthetic-user', email: 'private+synthetic@example.invalid',
    nome: 'Synthetic', cognome: 'Subject', ruolo: role, status: 'a',
    is_dpo: false, avatar_config: null, data_nascita: null, genere: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-02T00:00:00Z'),
  };
  for (const key of ids) user[key] = 'synthetic-sensitive-choice-' + key;
  return user;
}

async function execute(which, {
  granted = true, auth = true, schemaFallback = false,
  targetExists = true, consentError = false, role = 'E',
} = {}) {
  const src = source[which];
  const start = which === 'users'
    ? src.indexOf("router.get('/me', verifyToken, userDataAuditMiddleware")
    : src.indexOf("router.get('/me', async (req, res) =>");
  const end = which === 'users'
    ? src.indexOf('// POST /api/users/me/avatar', start)
    : src.indexOf('module.exports = router;', start);
  assert.ok(start > 0 && end > start, which + ' GET route bounds');

  const logs = [], statements = [], calls = [];
  const router = { get(p, ...fns) { assert.equal(p, '/me'); calls.push(...fns); } };
  let profileReads = 0;
  const pool = {
    async query(sql, params = []) {
      statements.push(String(sql));
      if (String(sql).includes('COALESCE(uc.political_opinions_consent')) {
        throw Error('Consent mock must be called via getPoliticalConsentState');
      }
      assert.deepEqual(Array.from(params), ['synthetic-user']);
      profileReads++;
      if (schemaFallback && profileReads === 1) {
        const error = Error('synthetic-hidden-schema-error');
        error.code = '42P01';
        throw error;
      }
      return { rows: targetExists ? [fixtureUser(role)] : [] };
    }
  };
  let consentReads = 0;
  const context = {
    router, pool, Date, JSON, String,
    verifyToken: (req, res, next) => auth ? next() : res.status(401).json({ success: false }),
    userDataAuditMiddleware: (_req, _res, next) => next(),
    getAccountSubject: async (_pool, id) => {
      assert.equal(id, 'synthetic-user');
      return { legacyRole: role, capabilities: { isAdmin: role === 'AD' } };
    },
    getPoliticalConsentState: async (db, id) => {
      assert.equal(db, pool);
      assert.equal(id, 'synthetic-user');
      consentReads++;
      if (consentError) throw Error('synthetic-private-consent-database-message');
      return { exists: true, granted };
    },
    maskPoliticalSelectionsWithoutConsent,
    verifyAccessToken: () => {
      if (!auth) throw Error('invalid synthetic bearer');
      return { userId: 'synthetic-user' };
    },
    verifyOAuthPendingToken: () => { throw Error('not a pending token'); },
    decryptEmail: value => value,
    decompressGender: value => value,
    decompressUserLocation: value => value,
    isSchemaMigrationError: error => ['42P01', '42703'].includes(error?.code),
    console: {
      log: (...parts) => logs.push(parts),
      warn: (...parts) => logs.push(parts),
      error: (...parts) => logs.push(parts)
    }
  };
  vm.runInNewContext(src.slice(start, end), context, { filename: 'own-profile-' + which + '.js' });
  const res = {
    code: 200, body: null,
    status(n) { this.code = n; return this; },
    json(value) { this.body = value; return this; },
    set() { return this; }
  };
  const req = {
    user: { id: 'synthetic-user' },
    headers: auth ? { authorization: 'Bearer synthetic-access' } : {}
  };
  for (const middleware of calls) {
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-private-consent-database-message|synthetic-hidden-schema-error|private\+synthetic/);
  return { res, statements, logs, consentReads };
}

test('shared projection masks exactly every legacy political selection, not roles/identity', () => {
  assert.deepEqual([...PERSONAL_SELECTION_FIELDS].sort(), [...ids].sort());
  const source = fixtureUser('AD');
  const oldFields = { ...source };
  const masked = maskPoliticalSelectionsWithoutConsent(source, false);
  assert.notEqual(masked, source);
  for (const field of ids) {
    assert.equal(masked[field], null);
    assert.equal(source[field], oldFields[field]);
  }
  assert.equal(masked.id, source.id);
  assert.equal(masked.ruolo, 'AD');
  assert.equal(masked.email, source.email);
  assert.equal(maskPoliticalSelectionsWithoutConsent(source, true).candidato_camera,
    'synthetic-sensitive-choice-candidato_camera');
  assert.equal(maskPoliticalSelectionsWithoutConsent(source, null).candidato_camera, null);
});

for (const which of ['users', 'auth']) {
  test(which + '/me: active consent preserves 10 selections and profile identity', async () => {
    const { res, consentReads } = await execute(which);
    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    assert.equal(consentReads, 1);
    for (const field of ids)
      assert.equal(res.body.user[field], 'synthetic-sensitive-choice-' + field);
    assert.equal(res.body.user.nome, 'Synthetic');
    assert.equal(res.body.user.ruolo, 'E');
  });

  test(which + '/me: revoked consent masks selections, even for admin account', async () => {
    const { res, consentReads } = await execute(which, { granted: false, role: 'AD' });
    assert.equal(res.code, 200);
    assert.equal(consentReads, 1);
    for (const field of ids) assert.equal(res.body.user[field], null);
    assert.equal(JSON.stringify(res.body).includes('synthetic-sensitive-choice'), false);
    assert.equal(res.body.user.nome, 'Synthetic');
    assert.equal(res.body.user.ruolo, 'AD');
  });

  test(which + '/me: legacy SELECT * fallback also masks selections', async () => {
    const { res, statements } = await execute(which, { granted: false, schemaFallback: true });
    assert.equal(res.code, 200);
    assert.equal(statements.length, 2);
    assert.match(statements[1], /SELECT \* FROM users WHERE id = \$1/);
    for (const field of ids) assert.equal(res.body.user[field], null);
  });

  test(which + '/me: DB consent error fails closed (500, no sensitive body/log)', async () => {
    const { res } = await execute(which, { consentError: true });
    assert.equal(res.code, 500);
    assert.equal(JSON.stringify(res.body).includes('synthetic-sensitive-choice'), false);
    assert.equal(JSON.stringify(res.body).includes('synthetic-private-consent'), false);
  });

  test(which + '/me: absent account produces 404 without consent query', async () => {
    const { res, consentReads } = await execute(which, { targetExists: false });
    assert.equal(res.code, 404);
    assert.equal(consentReads, 0);
  });

  test(which + '/me: missing or invalid authentication returns 401 without DB read', async () => {
    const { res, statements } = await execute(which, { auth: false });
    assert.equal(res.code, 401);
    assert.equal(statements.length, 0);
  });

  test(which + '/me: cache protection and final consent check are present', () => {
    const full = source[which];
    assert.match(full, /Cache-Control', 'private, no-store, max-age=0'/);
    const start = full.indexOf("const currentConsent = await getPoliticalConsentState(pool, ");
    const end = full.indexOf('    res.json({\n      success: true,\n      user: {', start);
    assert.ok(start > 0 && end > start, 'Consent check must be immediately before response');
    for (const field of ids)
      assert.ok(full.includes(field + ': visibleUser.' + field + ','), field);
  });
}
