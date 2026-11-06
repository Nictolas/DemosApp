'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const pgPath = require.resolve('pg');
const authPath = require.resolve('../middleware/auth');
const routePath = require.resolve('../routes/rappresentanti-sostenitori');
const totalRoutePath = require.resolve('../routes/sostenitori-totale');

async function withIsolatedSupportersRoute(run) {
  const previous = [pgPath, authPath, routePath, totalRoutePath].map((path) => require.cache[path]);
  const calls = [];
  const rows = [
    { id: 'voter-1', genere: 'M', regione_residenza: 'Trentino-Alto Adige', provincia_residenza: 'TN',
      supporter_role: 'Rappresentante Regionale', email: 'synthetic-a@example.invalid' },
    { id: 'voter-1', genere: 'M', regione_residenza: 'Trentino-Alto Adige', provincia_residenza: 'TN',
      supporter_role: 'Rappresentante Provinciale', email: 'synthetic-a@example.invalid' },
    { id: 'voter-2', genere: 'F', regione_residenza: 'Trentino-Alto Adige', provincia_residenza: 'TN',
      supporter_role: 'Rappresentante Provinciale', email: 'synthetic-b@example.invalid' },
  ];
  require.cache[pgPath] = {
    id: pgPath, filename: pgPath, loaded: true,
    exports: { Pool: class {
      async query(sql, params) {
        calls.push({ sql: String(sql), params });
        return { rows };
      }
    } },
  };
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: { verifyToken(req, _res, next) {
      req.userId = 'subject';
      req.user = { id: 'subject', isAdmin: req.headers['x-synthetic-admin'] === 'true' };
      next();
    } },
  };
  delete require.cache[routePath];
  delete require.cache[totalRoutePath];
  const app = express();
  app.use('/api/rappresentanti', require(routePath));
  app.use('/api/sostenitori', require(totalRoutePath));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const originalGate = process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
  try {
    await run('http://127.0.0.1:' + server.address().port, calls);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalGate === undefined) delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    else process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = originalGate;
    [pgPath, authPath, routePath, totalRoutePath].forEach((path, i) => {
      if (previous[i]) require.cache[path] = previous[i];
      else delete require.cache[path];
    });
  }
}

test('supporter totals keep pre-GO legacy behavior and require owner/admin access', async () => {
  await withIsolatedSupportersRoute(async (base, calls) => {
    delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    let response = await fetch(base + '/api/rappresentanti/sostenitori?sostenuto_id=someone-else');
    assert.equal(response.status, 403);
    assert.equal(calls.length, 0, 'unauthorized request never reads preferences');

    response = await fetch(base + '/api/rappresentanti/sostenitori?sostenuto_id=subject');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.stats.totalSupporters, 2, 'one voter counts once even with multiple roles');
    assert.deepEqual(body.supporters, [], 'non-admin cannot retrieve supporter identities');
    assert.equal(calls.length, 1);
    assert.doesNotMatch(calls[0].sql, /political_selections|provincial_supporters/);
    assert.deepEqual(calls[0].params, ['subject']);
  });
});

test('post-GO canonical provincial choice uses distinct voter IDs with no extra query', async () => {
  await withIsolatedSupportersRoute(async (base, calls) => {
    process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
    const response = await fetch(base + '/api/rappresentanti/sostenitori?sostenuto_id=subject', {
      headers: { 'x-synthetic-admin': 'true' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.stats.totalSupporters, 2, 'one citizen with both mandates counts once');
    assert.equal(body.supporters.length, 2);
    assert.equal(calls.length, 1, 'single SQL query for combined tally');
    assert.match(calls[0].sql, /WITH provincial_supporters AS/);
    assert.match(calls[0].sql, /SELECT DISTINCT ps\.user_id/);
    assert.match(calls[0].sql, /ps\.selection_kind = 'representative'/);
    assert.match(calls[0].sql, /JOIN users voter ON voter\.id = ps\.user_id/);
    assert.match(calls[0].sql, /LEFT JOIN user_consents uc ON uc\.user_id = voter\.id/);
    assert.match(calls[0].sql, /voter\.status = 'a'/);
    assert.match(calls[0].sql, /COALESCE\(uc\.political_opinions_consent, voter\.political_opinions_consent, false\) IS TRUE/);
    assert.match(calls[0].sql, /'it\.provincial\.trento', 'it\.provincial\.bolzano'/);
    assert.match(calls[0].sql, /LEFT JOIN provincial_supporters provincial ON provincial\.user_id = u\.id/);
    assert.match(calls[0].sql, /OR provincial\.user_id IS NOT NULL/);
    assert.deepEqual(calls[0].params, ['subject']);
  });
});


test('combined all-role supporters enforce permissions and hide provincial rows pre-GO', async () => {
  await withIsolatedSupportersRoute(async (base, calls) => {
    delete process.env.DEMOS_PROVINCIAL_SELECTIONS_GO;
    let response = await fetch(base + '/api/sostenitori/totale?sostenuto_id=someone-else');
    assert.equal(response.status, 403);
    assert.equal(calls.length, 0, 'access is checked before reading political preferences');
    response = await fetch(base + '/api/sostenitori/totale?sostenuto_id=subject');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.stats.totalSupporters, 2);
    assert.deepEqual(body.supporters, [], 'identities only returned to admins');
    assert.equal(calls.length, 1);
    assert.doesNotMatch(calls[0].sql, /political_selections|provincial_supporters/);
    assert.deepEqual(calls[0].params, ['subject']);
  });
});

test('combined all-role supporters count provincial/regional supporters once after GO', async () => {
  await withIsolatedSupportersRoute(async (base, calls) => {
    process.env.DEMOS_PROVINCIAL_SELECTIONS_GO = 'true';
    const response = await fetch(base + '/api/sostenitori/totale?sostenuto_id=subject', {
      headers: { 'x-synthetic-admin': 'true' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.stats.totalSupporters, 2);
    assert.equal(body.supporters.length, 2);
    assert.equal(calls.length, 1, 'combined list uses one SQL query');
    assert.match(calls[0].sql, /SELECT DISTINCT ps\.user_id/);
    assert.match(calls[0].sql, /ps\.selection_kind = 'representative'/);
    assert.match(calls[0].sql, /JOIN users voter ON voter\.id = ps\.user_id/);
    assert.match(calls[0].sql, /LEFT JOIN user_consents uc ON uc\.user_id = voter\.id/);
    assert.match(calls[0].sql, /voter\.status = 'a'/);
    assert.match(calls[0].sql, /COALESCE\(uc\.political_opinions_consent, voter\.political_opinions_consent, false\) IS TRUE/);
    assert.match(calls[0].sql, /'it\.provincial\.trento', 'it\.provincial\.bolzano'/);
    assert.match(calls[0].sql, /LEFT JOIN provincial_supporters provincial ON provincial\.user_id = u\.id/);
    assert.match(calls[0].sql, /OR provincial\.user_id IS NOT NULL/);
    assert.deepEqual(calls[0].params, ['subject']);
  });
});
