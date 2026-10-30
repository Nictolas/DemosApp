'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const Module = require('node:module');

const authModule = path.resolve(__dirname, '../middleware/auth.js');
const dpoModule = path.resolve(__dirname, '../middleware/dpoAccess.js');
const routeModule = path.resolve(__dirname, '../routes/dpo/overview.js');
const originalLoad = Module._load;
const { getAllOpinions } = require('../services/opinionCatalog');
let revoked = false;
let databaseFailed = false;
const queries = [];
const pool = {
  async query(sql, params) {
    queries.push(sql);
    assert.match(sql, /^\s*SELECT\s/i, 'DPO read-only endpoints must not write to DB');
    if (databaseFailed) throw new Error('synthetic-database-error');
    if (/SELECT is_dpo, is_admin, status FROM public\.users/.test(sql)) {
      assert.equal(params?.length, 1);
      if (params[0] === 'admin') return { rows: [{ status: 'a', is_admin: true, is_dpo: false }] };
      if (params[0] === 'dpo' && !revoked) return { rows: [{ status: 'a', is_admin: false, is_dpo: true }] };
      return { rows: [{ status: 'a', is_admin: false, is_dpo: false }] };
    }
    assert.match(sql, /COUNT\(\*\)/i);
    assert.doesNotMatch(sql, /opinioni_risposte|voti_opinioni|SELECT\s+\*/i);
    return { rows: [{
      users_total: 10, users_active: 9, recognitions_total: 2,
      recognitions_last_30d: 1,
      opinions_total: 4, proposed_opinions_total: 3, proposals_last_30d: 2,
      notifications_total: 1, notifications_last_30d: 1,
      notifications_latest_date: '2026-10-24',
      ministry_initiatives_total: 5, initiatives_last_30d: 3,
      parliamentary_votes_total: 6, parliamentary_votes_last_30d: 2
    }] };
  }
};

let router;
try {
  Module._load = function (request, parent, isMain) {
    if (
      (parent?.filename === routeModule && request === '../../middleware/auth') ||
      (parent?.filename === dpoModule && request === './auth')
    ) {
      return {
        pool,
        verifyToken(req, res, next) {
          const header = req.headers.authorization || '';
          if (!header.startsWith('Bearer synthetic-')) return res.status(401).json({ success: false });
          req.user = { id: header.slice('Bearer synthetic-'.length) };
          return next();
        }
      };
    }
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[dpoModule];
  delete require.cache[routeModule];
  router = require(routeModule);
} finally {
  Module._load = originalLoad;
}

const express = require('express');
const app = express();
app.use('/api/dpo', router);

async function request(token, method = 'GET') {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch('http://127.0.0.1:' + address.port + '/api/dpo/areas', {
      method,
      headers: token ? { Authorization: 'Bearer synthetic-' + token } : {}
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('DPO and Admin see only aggregate figures; no writes or individual data', async () => {
  const dpo = await request('dpo');
  assert.equal(dpo.status, 200);
  assert.equal(dpo.body.data.scope, 'aggregated_readonly');
  assert.equal(dpo.body.data['utenti-verifiche'].users_total, 10);
  assert.equal(dpo.body.data.contenuti.opinions_total, getAllOpinions().length);
  assert.ok(queries.every(sql => !sql.includes('opinioni_domande')), 'No legacy catalog DB reads in DPO oversight');
  assert.equal(dpo.body.data.contenuti.proposals_last_30d, 2);
  assert.equal(dpo.body.data.comunicazioni.notifications_last_30d, 1);
  assert.equal(dpo.body.data.comunicazioni.notifications_latest_date, '2026-10-24');
  assert.equal(dpo.body.data['utenti-verifiche'].recognitions_last_30d, 1);
  assert.equal(dpo.body.data['dati-istituzionali'].initiatives_last_30d, 3);
  assert.equal(dpo.body.data['dati-istituzionali'].parliamentary_votes_total, 6);
  assert.deepEqual(Object.keys(dpo.body.data).sort(), [
    'comunicazioni', 'contenuti', 'dati-istituzionali', 'ops-center', 'scope', 'utenti-verifiche'
  ].sort());
  assert.equal((await request('admin')).status, 200);
  assert.ok(queries.every(sql => /^\s*SELECT\s/i.test(sql)));
  assert.doesNotMatch(JSON.stringify(dpo.body), /email|phone|voto_individuale|password|token/i);
});

test('unauthorized, normal and revoked accounts cannot read DPO areas', async () => {
  assert.equal((await request()).status, 401);
  assert.equal((await request('ordinary')).status, 403);
  revoked = true;
  assert.equal((await request('dpo')).status, 403);
  revoked = false;
  assert.equal((await request('ordinary', 'POST')).status, 403);
});

test('database failures fail closed and expose no details', async () => {
  const original = console.error;
  console.error = () => {};
  databaseFailed = true;
  try {
    const response = await request('dpo');
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(response.body), /synthetic-database-error/);
  } finally {
    databaseFailed = false;
    console.error = original;
  }
});
