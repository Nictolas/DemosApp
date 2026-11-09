'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const authPath = require.resolve('../middleware/auth');
const civicPath = require.resolve('../middleware/civicIdentity');
const matchingPath = require.resolve('../services/politicalMatchingService');
const eligibilityPath = require.resolve('../services/politicalEligibilityService');
const routePath = require.resolve('../routes/users/profile');

async function serveSyntheticProvincialWrite(lockedConsent, callback) {
  const modules = [authPath, civicPath, matchingPath, eligibilityPath, routePath];
  const previous = modules.map((name) => require.cache[name]);
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ connection: 'transaction', statement, params });
      if (['BEGIN', 'ROLLBACK', 'COMMIT'].includes(statement)) return { rows: [], rowCount: 0 };
      if (statement.includes('FOR UPDATE OF u')) {
        assert.match(statement, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
        assert.match(statement, /u\.political_opinions_consent IS TRUE/);
        assert.deepEqual(params, ['owner-1']);
        return { rows: lockedConsent === null ? [] : [{ id: 'owner-1', granted: lockedConsent }] };
      }
      if (statement.startsWith('INSERT INTO political_selections')) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error('Unexpected transaction query: ' + statement);
    },
    release() { released = true; },
  };
  const pool = {
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ connection: 'pool', statement, params });
      if (statement.includes('LEFT JOIN user_consents uc')) {
        assert.deepEqual(params, ['owner-1']);
        // This check is deliberately stale: revocation happens before the lock.
        return { rows: [{ id: 'owner-1', granted: true }] };
      }
      throw new Error('Unexpected standalone query: ' + statement);
    },
    async connect() { return client; },
  };
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      pool,
      verifyToken(req, _res, next) { req.userId = 'owner-1'; req.user = { id: 'owner-1' }; next(); },
      requireAdmin(_req, _res, next) { next(); },
    },
  };
  require.cache[civicPath] = {
    id: civicPath, filename: civicPath, loaded: true,
    exports: { requireVerifiedCivicIdentity(_req, _res, next) { next(); } },
  };
  require.cache[matchingPath] = {
    id: matchingPath, filename: matchingPath, loaded: true,
    exports: { async getUserOpinionCompletion() { return { isComplete: true }; } },
  };
  require.cache[eligibilityPath] = {
    id: eligibilityPath, filename: eligibilityPath, loaded: true,
    exports: {
      async isCandidateSelectionEligible() { return {
        eligible: true, strict: true, source: 'CAPABILITY',
        subjects: [{ id: 'subject-1', candidacy_id: 'cand-1' }],
      }; },
      async isRepresentativeSelectionEligible() { return {
        eligible: true, strict: true, source: 'CAPABILITY',
        subjects: [{ id: 'subject-1', mandate_id: 'mand-1' }],
      }; },
    },
  };
  delete require.cache[routePath];
  const app = express();
  app.use(express.json());
  app.use('/api/users', require(routePath));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await callback('http://127.0.0.1:' + server.address().port, calls, () => released);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    modules.forEach((name, i) => {
      if (previous[i]) require.cache[name] = previous[i];
      else delete require.cache[name];
    });
  }
}

async function sendChoice(base, kind) {
  return fetch(base + '/api/users/owner-1/political-selection', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind, officeId: 'it.provincial.trento', selectedUserId: 'subject-1',
      source: 'matching',
    }),
  });
}

test('concurrent revocation after the optimistic precheck refuses provincial writes under user row lock', async () => {
  const previous = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
  try {
    for (const kind of ['candidate', 'representative']) {
      await serveSyntheticProvincialWrite(false, async (base, calls, released) => {
        const response = await sendChoice(base, kind);
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, 'POLITICAL_CONSENT_REQUIRED');
        const tx = calls.filter((call) => call.connection === 'transaction').map((call) => call.statement);
        assert.equal(tx[0], 'BEGIN');
        assert.match(tx[1], /FOR UPDATE OF u$/);
        assert.equal(tx[2], 'ROLLBACK');
        assert.ok(!tx.some((statement) => statement.startsWith('INSERT INTO political_selections')));
        assert.ok(!tx.includes('COMMIT'));
        assert.equal(released(), true);
      });
    }
  } finally {
    if (previous === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = previous;
  }
});

test('provincial write holds consent lock until canonical insertion and commit', async () => {
  const previous = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
  try {
    await serveSyntheticProvincialWrite(true, async (base, calls, released) => {
      const response = await sendChoice(base, 'representative');
      assert.equal(response.status, 200);
      assert.equal((await response.json()).selection.storage, 'CANONICAL');
      const tx = calls.filter((call) => call.connection === 'transaction').map((call) => call.statement);
      assert.equal(tx[0], 'BEGIN');
      assert.match(tx[1], /FOR UPDATE OF u$/);
      assert.match(tx[2], /^INSERT INTO political_selections/);
      assert.equal(tx[3], 'COMMIT');
      assert.ok(!tx.some((statement) => statement.startsWith('UPDATE users')));
      assert.equal(released(), true);
    });
  } finally {
    if (previous === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = previous;
  }
});

test('missing owner cannot create a provincial choice after the user row lock', async () => {
  const previous = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
  try {
    await serveSyntheticProvincialWrite(null, async (base, calls, released) => {
      const response = await sendChoice(base, 'representative');
      assert.equal(response.status, 404);
      assert.ok(!calls.some((call) => call.statement.startsWith('INSERT INTO political_selections')));
      assert.equal(calls.filter((call) => call.statement === 'ROLLBACK').length, 1);
      assert.equal(released(), true);
    });
  } finally {
    if (previous === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = previous;
  }
});
