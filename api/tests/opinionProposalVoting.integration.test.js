const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const ROOT = path.resolve(__dirname, '..');
const routePath = require.resolve('../routes/opinioni-proposte.js');
const mockPaths = {
  auth: require.resolve('../middleware/auth.js'),
  civic: require.resolve('../middleware/civicIdentity.js'),
  consent: require.resolve('../middleware/politicalConsent.js'),
  db: require.resolve('../config/database.js')
};

async function withProposalAPI({ initialVotes = [], failUserVotes = false } = {}, run) {
  const original = new Map(Object.values(mockPaths).concat(routePath).map(p => [p, require.cache[p]]));
  const votes = initialVotes.slice();
  const active = ['p1', 'p2', 'p3'];
  let lockTail = Promise.resolve();

  function queryFor(state) {
    return async (raw, params = []) => {
      const sql = String(raw).replace(/\\s+/g, ' ').trim();
      if (sql === 'BEGIN') return { rows: [], rowCount: 0 };
      if (sql === 'COMMIT' || sql === 'ROLLBACK') {
        if (state?.unlock) { state.unlock(); state.unlock = null; }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("to_regclass('public.voti_opinioni_proposte')")) return { rows: [{ relation_name: 'voti_opinioni_proposte' }] };
      if (sql.includes("to_regclass('public.opinioni_proposte')")) return { rows: [{ has_separate_proposals: true }] };
      if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
        const previous = lockTail;
        lockTail = new Promise(resolve => { state.unlock = resolve; });
        await previous;
        return { rows: [{ id: params[0] }], rowCount: 1 };
      }
      if (sql.includes('SELECT id FROM opinioni_proposte WHERE id = $1')) {
        return { rows: active.includes(params[0]) ? [{ id: params[0] }] : [], rowCount: Number(active.includes(params[0])) };
      }
      if (sql.includes('SELECT v.opinione_id FROM voti_opinioni_proposte v')) {
        if (failUserVotes) throw Object.assign(new Error('simulated read failure'), { code: 'TEST_READ_ERROR' });
        return { rows: votes.filter(x => active.includes(x)).map(opinione_id => ({ opinione_id })) };
      }
      if (sql.includes('INSERT INTO voti_opinioni_proposte')) {
        const opinionId = params[1];
        if (votes.includes(opinionId)) return { rows: [], rowCount: 0 };
        votes.push(opinionId);
        return { rows: [{ opinione_id: opinionId }], rowCount: 1 };
      }
      throw new Error('Unexpected test SQL: ' + sql.slice(0, 140));
    };
  }

  const pool = {
    query: queryFor(null),
    async connect() {
      const state = { unlock: null };
      return { query: queryFor(state), release() { if (state.unlock) state.unlock(); } };
    }
  };
  const mocks = [
    [mockPaths.auth, { verifyToken: (req, _res, next) => { req.userId = 'u1'; next(); }, requireAdmin: (_req, _res, next) => next() }],
    [mockPaths.civic, { requireVerifiedCivicIdentity: (_req, _res, next) => next() }],
    [mockPaths.consent, { requirePoliticalConsent: (_req, _res, next) => next() }],
    [mockPaths.db, { getPool: () => pool }]
  ];
  for (const [filename, exports] of mocks) {
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  delete require.cache[routePath];
  const router = require(routePath);
  const app = express();
  app.use('/api/opinioni-proposte', router);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/opinioni-proposte`;
  try {
    await run({ url, votes });
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [filename, entry] of original) {
      if (entry) require.cache[filename] = entry;
      else delete require.cache[filename];
    }
  }
}

test('one active vote allowed; second distinct proposal is rejected server-side', async () => {
  await withProposalAPI({}, async ({ url, votes }) => {
    const first = await fetch(url + '/p1/vota', { method: 'POST' });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).success, true);
    const second = await fetch(url + '/p2/vota', { method: 'POST' });
    assert.equal(second.status, 409);
    assert.equal((await second.json()).error, 'LIMITE_VOTI_RAGGIUNTO');
    assert.deepEqual(votes, ['p1']);
    const mine = await fetch(url + '/voti-utente');
    assert.deepEqual((await mine.json()).data, ['p1']);
  });
});

test('concurrent votes for distinct proposals cannot both commit', async () => {
  await withProposalAPI({}, async ({ url, votes }) => {
    const results = await Promise.all(['p1', 'p2'].map(id =>
      fetch(url + '/' + id + '/vota', { method: 'POST' })
    ));
    assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
    assert.equal(votes.length, 1);
  });
});

test('historical votes on removed proposals do not consume a pending vote slot', async () => {
  await withProposalAPI({ initialVotes: ['closed-proposal'] }, async ({ url, votes }) => {
    const mine = await fetch(url + '/voti-utente');
    assert.deepEqual((await mine.json()).data, []);
    const result = await fetch(url + '/p1/vota', { method: 'POST' });
    assert.equal(result.status, 200);
    assert.deepEqual(votes, ['closed-proposal', 'p1']);
  });
});

test('vote-read errors return an explicit 500, never a false empty list', async () => {
  await withProposalAPI({ failUserVotes: true }, async ({ url }) => {
    const result = await fetch(url + '/voti-utente');
    assert.equal(result.status, 500);
    assert.equal((await result.json()).success, false);
  });
});

test('automatic proposer vote happens within its user-locked transaction', () => {
  const source = fs.readFileSync(path.join(ROOT, 'routes/opinioni-proposte.js'), 'utf8');
  const create = source.slice(source.indexOf("router.post('/', verifyToken"), source.indexOf('// POST /api/opinioni-proposte/:id/vota'));
  const lock = create.indexOf('SELECT opinione_proposta_id FROM users WHERE id = $1 FOR UPDATE');
  const active = create.indexOf('getActiveProposalVotes(client, userId, hasSeparateProposals)');
  const insert = create.indexOf('INSERT INTO voti_opinioni_proposte', active);
  const commit = create.indexOf("await client.query('COMMIT')");
  assert.ok(lock > -1 && active > lock && insert > active && commit > insert);
});
