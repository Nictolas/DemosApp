'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'opinioni', 'user-answers.js'),
  'utf8'
);

async function save({ current = null, opinions, politician = false, consent = true, revokedAfterLock = false, userExists = true }) {
  const writes = [];
  const queries = [];
  let notifications = 0;
  let pushCalls = 0;
  let notificationChanges = [];
  const callbacks = new Map();

  const query = async (sql, params = []) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    queries.push({ sql: normalized, params });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [], rowCount: 0 };
    if (normalized === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
      return { rows: userExists ? [{ id: 'test-user' }] : [] };
    }
    if (normalized.includes('political_opinions_consent') && normalized.includes('AS granted')) {
      return { rows: [{ granted: consent && !revokedAfterLock }] };
    }
    if (normalized.includes('information_schema.columns') && normalized.includes('opinioni_risposte')) {
      return { rows: Object.keys(opinions).map((column_name) => ({ column_name })) };
    }
    if (normalized.includes('FROM opinioni_risposte') && normalized.includes('FOR UPDATE')) {
      return { rows: current ? [{ user_id: 'test-user', ...current }] : [] };
    }
    if (normalized.startsWith('UPDATE opinioni_risposte') ||
        normalized.startsWith('INSERT INTO opinioni_risposte')) {
      writes.push({ sql: normalized, params });
      return { rowCount: 1, rows: [] };
    }
    throw new Error('Unexpected SQL: ' + normalized.slice(0, 160));
  };
  const pool = { query, async connect() { return { query, release() {} }; } };
  const router = {
    get() {},
    put() {},
    delete() {},
    post(route, ...handlers) { callbacks.set(route, handlers.at(-1)); }
  };
  const imports = {
    express: { Router: () => router },
    '../../middleware/auth': { pool, verifyToken() {}, requireAdmin() {} },
    '../../utils/politicalMatching': {
      normalizeOpinionAnswer(value) {
        return ({ f: 'f', c: 'c', i: 'i', Favorevole: 'f', Contrario: 'c', 'Non lo so': 'i' })[value] || null;
      }
    },
    '../../services/politicalOpinionNotificationService': {
      async createSupporterOpinionNotifications(_client, options) {
        notifications += 1;
        notificationChanges = options.changes;
        return { created: 1 };
      }
    },
    '../../services/currentSupporterPushService': {
      async sendPushToCurrentSupporters() { pushCalls += 1; }
    },
    '../../middleware/civicIdentity': { requireVerifiedCivicIdentity() {} }
  };

  const moduleMock = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleMock,
    require(name) {
      if (!(name in imports)) throw new Error('Unexpected import: ' + name);
      return imports[name];
    },
    console: { log() {}, warn() {}, error() {} }
  }, { filename: 'user-answers.js' });
  let response;
  let status = 200;
  const res = {
    status(code) { status = code; return this; },
    json(data) { response = JSON.parse(JSON.stringify(data)); return this; }
  };
  await callbacks.get('/salva')({
    userId: 'test-user',
    user: { id: 'test-user', isPolitician: politician, isCandidate: false },
    body: { opinioni: opinions }
  }, res);
  return { status, response, writes, queries, notifications, pushCalls, notificationChanges };
}

function allAnswers(size = 94) {
  return Object.fromEntries(Array.from({ length: size }, (_, n) => ['question_' + (n + 1), 'f']));
}

test('94 unchanged answers do not cause database UPDATE; API count remains stable', async () => {
  const opinions = allAnswers();
  const result = await save({ current: opinions, opinions });
  assert.equal(result.status, 200);
  assert.equal(result.response.savedCount, 94);
  assert.equal(result.writes.length, 0);
  assert.equal(result.notifications, 0);
  assert.equal(result.queries.filter(({sql}) => sql.includes('FOR UPDATE')).length, 2);
  const lockIndex = result.queries.findIndex(({sql}) => sql === 'SELECT id FROM users WHERE id = $1 FOR UPDATE');
  const consentIndex = result.queries.findIndex(({sql}) => sql.includes('political_opinions_consent') && sql.includes('AS granted'));
  assert.ok(lockIndex >= 0 && consentIndex > lockIndex, 'consent must be checked after user lock');
});

test('one change among 94 answers writes only the changed field', async () => {
  const previous = allAnswers();
  const opinions = { ...previous, question_80: 'c' };
  const result = await save({ current: previous, opinions });
  assert.equal(result.status, 200);
  assert.equal(result.response.savedCount, 94);
  assert.equal(result.writes.length, 1);
  assert.match(result.writes[0].sql, /SET "question_80" = \$1 WHERE user_id = \$2/);
  assert.deepEqual(Array.from(result.writes[0].params), ['c', 'test-user']);
});

test('new user first answers are still inserted as a batch', async () => {
  const result = await save({ current: null, opinions: allAnswers() });
  assert.equal(result.status, 200);
  assert.equal(result.writes.length, 1);
  assert.match(result.writes[0].sql, /INSERT INTO opinioni_risposte/);
  assert.equal(result.response.savedCount, 94);
});

test('politician changes still notify; first-time answer to a field does not', async () => {
  const result = await save({
    current: { question_1: 'f', question_2: null },
    opinions: { question_1: 'c', question_2: 'i' },
    politician: true
  });
  assert.equal(result.status, 200);
  assert.equal(result.writes.length, 1);
  assert.equal(result.notifications, 1);
  assert.equal(result.pushCalls, 1);
  assert.equal(result.notificationChanges.length, 1);
  assert.equal(result.notificationChanges[0].opinionId, 'question_1');
});

test('politician resubmission with no changes does not notify or write', async () => {
  const opinions = { question_1: 'f' };
  const result = await save({ current: opinions, opinions, politician: true });
  assert.equal(result.status, 200);
  assert.equal(result.writes.length, 0);
  assert.equal(result.notifications, 0);
  assert.equal(result.pushCalls, 0);
});

test('missing political-consent is fail closed after acquiring user lock', async () => {
  const result = await save({ current: null, opinions: { question_1: 'f' }, consent: false });
  assert.equal(result.status, 403);
  assert.equal(result.response.consent_required, true);
  assert.equal(result.writes.length, 0);
  assert.ok(result.queries.some(({sql}) => sql === 'ROLLBACK'));
  assert.ok(!result.queries.some(({sql}) => sql === 'COMMIT'));
  assert.equal(result.queries.filter(({sql}) => sql === 'SELECT id FROM users WHERE id = $1 FOR UPDATE').length, 1);
});


test('revocation that wins the users-row lock blocks a delta write', async () => {
  const current = { question_1: 'f' };
  const result = await save({ current, opinions: { question_1: 'c' }, revokedAfterLock: true, politician: true });
  assert.equal(result.status, 403);
  assert.equal(result.response.consent_required, true);
  assert.equal(result.writes.length, 0);
  assert.equal(result.notifications, 0);
  assert.equal(result.pushCalls, 0);
  assert.ok(result.queries.some(({ sql }) => sql === 'ROLLBACK'));
  assert.ok(!result.queries.some(({ sql }) => sql === 'COMMIT'));
});

test('missing user aborts before reading consent or touching answers', async () => {
  const result = await save({ current: null, opinions: { question_1: 'f' }, userExists: false });
  assert.equal(result.status, 404);
  assert.equal(result.writes.length, 0);
  assert.ok(!result.queries.some(({ sql }) => sql.includes('AS granted')));
  assert.ok(result.queries.some(({ sql }) => sql === 'ROLLBACK'));
});

test('a first answer in a previously populated row is written without notifying supporters', async () => {
  const result = await save({ current: { question_1: null }, opinions: { question_1: 'i' }, politician: true });
  assert.equal(result.status, 200);
  assert.equal(result.response.savedCount, 1);
  assert.equal(result.writes.length, 1);
  assert.equal(result.notifications, 0);
  assert.equal(result.pushCalls, 0);
  assert.deepEqual(Array.from(result.writes[0].params), ['i', 'test-user']);
});
