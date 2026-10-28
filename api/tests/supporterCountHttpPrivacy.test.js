'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const paths = {
  database: require.resolve('../config/database'),
  auth: require.resolve('../middleware/auth'),
  route: require.resolve('../routes/sostenitori'),
};
const NO_STORE = 'private, no-store, max-age=0';

async function serve(run) {
  const original = new Map(Object.values(paths).map(p => [p, require.cache[p]]));
  const queries = [];
  const failures = [];
  const logged = [];
  const originalError = console.error;
  const pool = {
    async query(sql, params) {
      queries.push({sql, params});
      if (failures.length) throw failures.shift();
      return {rows: [sql.includes('AS politico')
        ? {politico: '3', candidato: '4'}
        : {attivista: '2', organizzazione: '1'}]};
    },
  };
  const mocks = {
    database: {getPool: () => pool},
    auth: {verifyToken(req, res, next) {
      const id = req.get('x-synthetic-user');
      if (!id) return res.status(401).json({error: 'Unauthorized'});
      req.userId = id;
      req.userRole = req.get('x-synthetic-role');
      req.user = {isAdmin: req.get('x-synthetic-admin') === 'true'};
      next();
    }},
  };
  for (const [key, value] of Object.entries(mocks)) {
    require.cache[paths[key]] = {id: paths[key], filename: paths[key], loaded: true, exports: value};
  }
  delete require.cache[paths.route];
  console.error = (...args) => logged.push(args.join(' '));
  let server;
  try {
    const app = express();
    app.use('/api/sostenitori', require(paths.route));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}/api/sostenitori`;
    await run({base, queries, failures, logged});
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    console.error = originalError;
    for (const [p, cached] of original) {
      if (cached) require.cache[p] = cached;
      else delete require.cache[p];
    }
  }
}

test('anonymous public totals never query or expose political supporter counts', async () => {
  await serve(async ({base, queries}) => {
    const response = await fetch(`${base}/totale?sostenuto_id=synthetic-subject`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), null);
    assert.deepEqual((await response.json()).data, {
      attivista: 2, organizzazione: 1, totale: 3,
      politico: null, candidato: null,
      restricted: {politico: true, candidato: true},
    });
    assert.equal(queries.length, 1);
    assert.doesNotMatch(queries[0].sql, /rappresentante_|candidato_/);
    assert.deepEqual(queries[0].params, ['synthetic-subject']);
  });
});

test('owners get only private aggregates regardless of legacy role; true Admin can query another account', async () => {
  await serve(async ({base, queries}) => {
    const subject = 'synthetic-subject';
    for (const role of ['E', 'P', 'C', 'CP', 'A', 'O']) {
      const response = await fetch(`${base}/totale-privato?sostenuto_id=${subject}`, {
        headers: {'x-synthetic-user': subject, 'x-synthetic-role': role},
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), NO_STORE);
      assert.deepEqual(await response.json(), {success: true, data: {
        politico: 3, candidato: 4, attivista: 2, organizzazione: 1, totale: 10,
      }});
    }
    const response = await fetch(`${base}/totale-privato?sostenuto_id=${subject}`, {
      headers: {'x-synthetic-user': 'synthetic-staff', 'x-synthetic-admin': 'true'},
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), NO_STORE);
    assert.equal(queries.length, 14);
    for (const query of queries) assert.deepEqual(query.params, [subject]);
  });
});

test('unauthenticated and non-owner requests including legacy AD labels stop before SQL', async () => {
  await serve(async ({base, queries}) => {
    const unauthenticated = await fetch(`${base}/totale-privato?sostenuto_id=synthetic-subject`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.headers.get('cache-control'), NO_STORE);
    for (const role of ['E', 'P', 'C', 'CP', 'A', 'O', 'AD']) {
      const response = await fetch(`${base}/totale-privato?sostenuto_id=synthetic-subject`, {
        headers: {'x-synthetic-user': 'synthetic-other', 'x-synthetic-role': role},
      });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('cache-control'), NO_STORE);
      assert.deepEqual(await response.json(), {success: false, error: 'Accesso negato'});
    }
    assert.equal(queries.length, 0);
  });
});

test('missing target and database failure never return cached or fabricated successful counts', async () => {
  await serve(async ({base, queries, failures, logged}) => {
    const missing = await fetch(`${base}/totale-privato`, {headers: {'x-synthetic-user': 'synthetic-subject'}});
    assert.equal(missing.status, 400);
    assert.equal(missing.headers.get('cache-control'), NO_STORE);
    assert.equal(queries.length, 0);
    failures.push(new Error('synthetic-private-query-detail'));
    const failed = await fetch(`${base}/totale-privato?sostenuto_id=synthetic-subject`, {
      headers: {'x-synthetic-user': 'synthetic-subject'},
    });
    assert.equal(failed.status, 500);
    assert.equal(failed.headers.get('cache-control'), NO_STORE);
    assert.deepEqual(await failed.json(), {success: false, error: 'Errore interno del server'});
    assert.deepEqual(logged, ['SUPPORTER_PRIVATE_COUNTS_FAILED']);
  });
});
