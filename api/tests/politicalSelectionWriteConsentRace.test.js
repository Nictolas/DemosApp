'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setPoliticalSelection } = require('../services/politicalSelectionService');

const USER = '00000000-0000-4000-8000-000000000289';
const TARGET = '00000000-0000-4000-8000-000000000290';

function syntheticDb({ userFound = true, granted = true, failConsent = false, failInsert = false } = {}) {
  const operations = [];
  const db = {
    async query(sql, params) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      operations.push({ sql: q, params });
      if (q === 'SELECT id FROM users WHERE id = $1 FOR UPDATE')
        return { rows: userFound ? [{ id: USER }] : [], rowCount: Number(userFound) };
      if (q.includes(' AS granted') && q.includes('FROM public.users u')) {
        if (failConsent) throw Error('synthetic-secret-database-message');
        return { rows: [{ id: USER, granted }], rowCount: 1 };
      }
      if (q.startsWith('INSERT INTO political_selections')) {
        if (failInsert) throw Error('synthetic-secret-insert-failure');
        return { rows: [], rowCount: 1 };
      }
      if (q.startsWith('DELETE FROM political_selections'))
        return { rows: [], rowCount: 1 };
      if (q.startsWith('UPDATE users SET'))
        return { rows: [{ id: USER }], rowCount: 1 };
      if (q.includes("to_regclass('public.user_representatives')"))
        return { rows: [{ available: false }], rowCount: 1 };
      throw Error('Unexpected synthetic statement: ' + q);
    }
  };
  return { db, operations };
}

function call(db, selectedUserId = TARGET, contract = { kind: 'representative', officeValue: 'it.camera' }) {
  return setPoliticalSelection(db, {
    userId: USER, selectedUserId, source: 'matching', ...contract
  });
}

test('active consent: acquire row lock, check on same client, then write canonical and legacy', async () => {
  const { db, operations } = syntheticDb();
  const result = await call(db);
  assert.equal(result.canonical.available, true);
  assert.equal(result.legacy.field, 'rappresentante_camera');
  const qs = operations.map(x => x.sql);
  assert.equal(qs[0], 'SELECT id FROM users WHERE id = $1 FOR UPDATE');
  assert.match(qs[1], /COALESCE\(uc.political_opinions_consent, u.political_opinions_consent, false\) AS granted/);
  assert.ok(qs.findIndex(x => x.startsWith('INSERT INTO political_selections')) > 1);
  assert.ok(qs.findIndex(x => x.startsWith('UPDATE users SET')) > 1);
  assert.equal(qs.filter(x => x.includes('FOR UPDATE')).length, 1);
});

test('revoked consent refuses to save a representative and leaves storage untouched', async () => {
  const { db, operations } = syntheticDb({ granted: false });
  await assert.rejects(call(db), error => error.code === 'POLITICAL_SELECTION_CONSENT_REQUIRED');
  assert.deepEqual(operations.map(x => x.sql.startsWith('SELECT')), [true, true]);
});

test('revoked consent also refuses a candidate and jurisdiction-neutral selections', async () => {
  for (const contract of [
    { kind: 'candidate', officeValue: 'it.camera' },
    { kind: 'candidate', officeValue: 'us.house', adapterId: 'us' }
  ]) {
    const { db, operations } = syntheticDb({ granted: false });
    await assert.rejects(call(db, TARGET, contract),
      error => error.code === 'POLITICAL_SELECTION_CONSENT_REQUIRED');
    assert.equal(operations.length, 2);
  }
});

test('voluntary deletion after revocation still works and does not require reinstating consent', async () => {
  const { db, operations } = syntheticDb({ granted: false });
  const result = await call(db, null);
  assert.equal(result.canonical.removed, true);
  assert.equal(result.legacy.field, 'rappresentante_camera');
  assert.equal(operations.filter(x => x.sql.includes(' AS granted')).length, 0);
  assert.equal(operations[0].sql, 'SELECT id FROM users WHERE id = $1 FOR UPDATE');
  assert.ok(operations.some(x => x.sql.startsWith('DELETE FROM political_selections')));
});

test('missing user is rejected before consent or any political write', async () => {
  const { db, operations } = syntheticDb({ userFound: false });
  await assert.rejects(call(db), error => error.code === 'POLITICAL_SELECTION_USER_NOT_FOUND');
  assert.equal(operations.length, 1);
});

test('consent DB failure is fail-closed: no new selection', async () => {
  const { db, operations } = syntheticDb({ failConsent: true });
  await assert.rejects(call(db), /synthetic-secret-database-message/);
  assert.equal(operations.length, 2);
});

test('canonical write failure never reaches legacy user fields', async () => {
  const { db, operations } = syntheticDb({ failInsert: true });
  await assert.rejects(call(db), /synthetic-secret-insert-failure/);
  assert.equal(operations.some(x => x.sql.startsWith('UPDATE users SET')), false);
});

test('all three routes map revoked consent to HTTP 403 and do not print SQL errors', () => {
  const routes = [
    { filename: 'routes/users/profile.js', occurrences: 2 },
    { filename: 'routes/candidati.js', occurrences: 1 }
  ];
  for (const route of routes) {
    const src = fs.readFileSync(path.join(__dirname, '..', route.filename), 'utf8');
    const region = route.filename.includes('/users/')
      ? src.slice(src.indexOf("// PUT /api/users/:userId/seleziona-rappresentante"), src.indexOf("// GET /api/users/:userId/opinioni"))
      : src.slice(src.indexOf("// PUT /api/candidati/seleziona-candidato"), src.indexOf("// GET /api/candidati/selezioni"));
    assert.equal((region.match(/error\?\.code === 'POLITICAL_SELECTION_CONSENT_REQUIRED'/g) || []).length, route.occurrences);
    assert.equal((region.match(/consent_required: true/g) || []).length, route.occurrences);
    assert.equal((region.match(/error\?\.code === 'POLITICAL_SELECTION_USER_NOT_FOUND'/g) || []).length, route.occurrences);
    assert.doesNotMatch(region, /console\.error\([^)]*, error\)/);
    assert.doesNotMatch(region, /console\.log\([^)]*(?:rappresentanteId|candidatoId|authenticatedUserId)/);
  }
});

test('consent check and user-row lock are in the shared service, not outside the transaction', () => {
  const src = fs.readFileSync(path.join(__dirname, '../services/politicalSelectionService.js'), 'utf8');
  const begin = src.indexOf('async function setPoliticalSelection(db,');
  const end = src.indexOf('async function loadLegacySelections', begin);
  const body = src.slice(begin, end);
  assert.ok(begin >= 0 && end > begin);
  assert.ok(body.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE'));
  assert.ok(body.indexOf('await getPoliticalConsentState(db, userId)') < body.indexOf('const canonical = await writeCanonicalSelection(db'));
  assert.ok(body.includes("selectedUserId !== null && selectedUserId !== undefined && selectedUserId !== ''"));
});
