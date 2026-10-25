'use strict';

// Exercises the real Express route on a synthetic pool, including the same
// user-row lock/consent check ordering used to coordinate GDPR revocation.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

const API = path.resolve(__dirname, '..');
const routePath = require.resolve(path.join(API, 'routes/opinioni/user-answers.js'));
const authPath = require.resolve(path.join(API, 'middleware/auth.js'));
const notificationPath = require.resolve(path.join(API, 'services/politicalOpinionNotificationService.js'));
const pushPath = require.resolve(path.join(API, 'services/currentSupporterPushService.js'));

const clone = obj => obj == null ? obj : JSON.parse(JSON.stringify(obj));
function answers(count = 94) {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => ['q' + (i + 1), 'f']));
}

async function withApi({
  initial = answers(94),
  consent = true,
  exists = true,
  isPolitician = false,
  failUpdate = false,
  failCommit = false
} = {}, exercise) {
  let current = clone(initial);
  const trace = [], updates = [], inserts = [], notifications = [];
  const allowed = new Set([...Object.keys(initial || {}), ...Object.keys(answers(94))]);

  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (s === 'BEGIN' || s === 'ROLLBACK' || s === 'COMMIT') {
      trace.push(s);
      if (s === 'COMMIT' && failCommit) throw Error('synthetic-commit-failure');
      return { rows: [], rowCount: 0 };
    }
    if (s === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
      trace.push('USER_LOCK');
      assert.equal(params[0], 'synthetic-account');
      return { rows: exists ? [{ id: 'synthetic-account' }] : [] };
    }
    if (s.includes('AS granted') && s.includes('user_consents')) {
      trace.push('CONSENT');
      return { rows: [{ granted: consent }] };
    }
    if (s.includes('information_schema.columns') && s.includes('opinioni_risposte')) {
      trace.push('COLUMNS');
      return { rows: Array.from(allowed).map(column_name => ({ column_name })) };
    }
    if (s.includes('FROM opinioni_risposte') && s.includes('FOR UPDATE')) {
      trace.push('READ_LOCKED');
      assert.match(s, /WHERE user_id = \$1 FOR UPDATE/);
      return { rows: current ? [{ user_id: 'synthetic-account', ...current }] : [] };
    }
    if (s.startsWith('INSERT INTO opinioni_risposte')) {
      trace.push('INSERT');
      inserts.push({ sql: s, params: clone(params) });
      assert.ok(!current, 'Must not INSERT an existing answer row');
      const columns = s.match(/\(user_id,\s*([^)]+)\)/)?.[1].split(',').map(x => x.trim()) || [];
      current = Object.fromEntries(columns.map((column, i) => [column, params[i + 1]]));
      return { rows: [], rowCount: 1 };
    }
    if (s.startsWith('UPDATE opinioni_risposte')) {
      trace.push('UPDATE');
      updates.push({ sql: s, params: clone(params) });
      if (failUpdate) return { rows: [], rowCount: 0 };
      const set = s.match(/SET (.+) WHERE user_id = \$(\d+)$/);
      assert.ok(set, 'Must use correct dollar placeholders for UPDATE');
      const assignments = set[1].split(', ');
      assert.equal(Number(set[2]), assignments.length + 1);
      assert.equal(params.at(-1), 'synthetic-account');
      for (let i = 0; i < assignments.length; i++) {
        const m = assignments[i].match(/^"([a-z]\w*)" = \$(\d+)$/);
        assert.ok(m, 'Unexpected or malformed SQL placeholder: ' + assignments[i]);
        assert.equal(Number(m[2]), i + 1);
        current[m[1]] = params[i];
      }
      return { rows: [], rowCount: 1 };
    }
    throw Error('Unexpected SQL in delta fixture: ' + s);
  };
  const pool = { query, async connect() { return { query, release() {} }; } };
  const snapshot = new Map(
    [authPath, notificationPath, pushPath, routePath].map(id => [id, require.cache[id]])
  );
  const replace = (id, exports) => {
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };
  replace(authPath, {
    pool, requireAdmin: (_req, res) => res.status(403).end(),
    verifyToken(req, res, next) {
      if (req.headers.authorization !== 'Bearer synthetic-token')
        return res.status(401).json({ success: false });
      req.userId = 'synthetic-account';
      req.user = {
        id: 'synthetic-account', isPolitician,
        isCandidate: false, isAdmin: false
      };
      next();
    }
  });
  replace(notificationPath, {
    async createSupporterOpinionNotifications(_db, options) {
      notifications.push(clone(options.changes));
      return { created: options.changes.length };
    }
  });
  const pushes = [];
  replace(pushPath, {
    async sendPushToCurrentSupporters(_db, options) {
      pushes.push(options);
      return { sent: 1 };
    }
  });
  delete require.cache[routePath];
  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/api/opinioni', require(routePath));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    async function save(opinioni, token = true) {
      const response = await fetch(origin + '/api/opinioni/salva', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer synthetic-token' } : {})
        },
        body: JSON.stringify({ opinioni })
      });
      return { status: response.status, body: await response.json() };
    }
    await exercise({ save, trace, updates, inserts, notifications, pushes,
      getCurrent: () => clone(current) });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [id, old] of snapshot) {
      if (old) require.cache[id] = old; else delete require.cache[id];
    }
  }
}

test('94 identical answers: 200 and savedCount 94 but ZERO SQL UPDATE', async () => {
  await withApi({}, async ({ save, trace, updates, notifications, pushes }) => {
    const result = await save(answers());
    assert.equal(result.status, 200);
    assert.equal(result.body.savedCount, 94);
    assert.equal(result.body.errorCount, 0);
    assert.deepEqual(updates, []);
    assert.deepEqual(notifications, []);
    assert.deepEqual(pushes, []);
    assert.deepEqual(trace.slice(-5), [
      'BEGIN', 'USER_LOCK', 'CONSENT', 'READ_LOCKED', 'COMMIT'
    ]);
  });
});

test('single altered value in 94 answers only updates its own SQL column', async () => {
  await withApi({}, async ({ save, updates, getCurrent }) => {
    const submitted = answers();
    submitted.q80 = 'c';
    const result = await save(submitted);
    assert.equal(result.status, 200);
    assert.equal(result.body.savedCount, 94);
    assert.equal(updates.length, 1);
    assert.match(updates[0].sql, /SET "q80" = \$1 WHERE user_id = \$2$/);
    assert.deepEqual(updates[0].params, ['c', 'synthetic-account']);
    assert.equal(getCurrent().q80, 'c');
    assert.equal(getCurrent().q79, 'f');
    assert.equal(getCurrent().q81, 'f');
  });
});

test('new answer row: INSERT remains a single batch (no UPDATE)', async () => {
  await withApi({ initial: null }, async ({ save, inserts, updates, getCurrent }) => {
    const result = await save({ q1: 'f', q2: 'c' });
    assert.equal(result.status, 200);
    assert.equal(result.body.savedCount, 2);
    assert.equal(inserts.length, 1);
    assert.equal(updates.length, 0);
    assert.equal(getCurrent().q2, 'c');
  });
});

test('first answer on a previously NULL field is written but never notifies supporters', async () => {
  await withApi({ initial: { q1: 'f', q2: null }, isPolitician: true }, async ctx => {
    const result = await ctx.save({ q1: 'f', q2: 'i' });
    assert.equal(result.status, 200);
    assert.equal(ctx.updates.length, 1);
    assert.match(ctx.updates[0].sql, /SET "q2" = \$1 WHERE user_id = \$2$/);
    assert.equal(ctx.notifications.length, 0);
    assert.equal(ctx.pushes.length, 0);
  });
});

test('politician position change still notifies once, only for modified positions', async () => {
  await withApi({ initial: { q1: 'f', q2: null, q3: 'c' }, isPolitician: true },
    async ctx => {
      const result = await ctx.save({ q1: 'c', q2: 'i', q3: 'c' });
      assert.equal(result.status, 200);
      assert.equal(ctx.updates.length, 1);
      assert.match(ctx.updates[0].sql, /SET "q1" = \$1, "q2" = \$2 WHERE user_id = \$3$/);
      assert.equal(ctx.notifications.length, 1);
      assert.deepEqual(ctx.notifications[0].map(x => x.opinionId), ['q1']);
      assert.equal(ctx.pushes.length, 1);
      assert.equal(result.body.notificationsCreated, 1);
    }
  );
});

test('politician no-op save never sends notification nor push', async () => {
  await withApi({ initial: { q1: 'c' }, isPolitician: true }, async ctx => {
    const result = await ctx.save({ q1: 'c' });
    assert.equal(result.status, 200);
    assert.equal(result.body.savedCount, 1);
    assert.deepEqual(ctx.updates, []);
    assert.deepEqual(ctx.notifications, []);
    assert.deepEqual(ctx.pushes, []);
  });
});

test('partial valid input keeps accepted-count and writes only valid changed answers', async () => {
  await withApi({ initial: { q1: 'f', q2: 'f' } }, async ctx => {
    const result = await ctx.save({ q1: 'c', q2: 'f', nonsense: 'f', q3: 'invalid' });
    assert.equal(result.status, 200);
    assert.equal(result.body.savedCount, 2);
    assert.equal(result.body.errorCount, 2);
    assert.equal(ctx.updates.length, 1);
    assert.match(ctx.updates[0].sql, /SET "q1" = \$1 WHERE user_id = \$2$/);
  });
});

test('revoked consent blocks even a no-op batch; no UPDATE nor notification', async () => {
  await withApi({ consent: false, isPolitician: true }, async ctx => {
    const result = await ctx.save(answers());
    assert.equal(result.status, 403);
    assert.equal(result.body.consent_required, true);
    assert.deepEqual(ctx.updates, []);
    assert.deepEqual(ctx.inserts, []);
    assert.deepEqual(ctx.notifications, []);
    assert.deepEqual(ctx.trace.slice(-4), ['BEGIN', 'USER_LOCK', 'CONSENT', 'ROLLBACK']);
  });
});

test('absent user blocks save after locked lookup, with rollback and no writes', async () => {
  await withApi({ exists: false }, async ctx => {
    const result = await ctx.save({ q1: 'c' });
    assert.equal(result.status, 404);
    assert.deepEqual(ctx.updates, []);
    assert.deepEqual(ctx.trace.slice(-3), ['BEGIN', 'USER_LOCK', 'ROLLBACK']);
  });
});

test('failed SQL UPDATE rolls back and does not publish supporter changes', async () => {
  await withApi({ initial: { q1: 'f' }, failUpdate: true, isPolitician: true },
    async ctx => {
      const result = await ctx.save({ q1: 'c' });
      assert.equal(result.status, 500);
      assert.equal(ctx.updates.length, 1);
      assert.equal(ctx.notifications.length, 0);
      assert.equal(ctx.pushes.length, 0);
      assert.ok(ctx.trace.includes('ROLLBACK'));
    });
});

test('unauthenticated POST is rejected before schema inspection or DB operations', async () => {
  await withApi({}, async ctx => {
    const result = await ctx.save({ q1: 'f' }, false);
    assert.equal(result.status, 401);
    assert.deepEqual(ctx.trace, []);
  });
});
