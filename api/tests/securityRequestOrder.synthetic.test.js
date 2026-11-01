/**
 * GH-186: test-only characterization of the middleware order currently used by app.js.
 *
 * This is a deliberately isolated Express harness, not an import of the live app:
 * requiring app.js can start background jobs. No provider, DB, real accounts or
 * external service is accessed. The known failing protections are documented by
 * assertions of observed behavior; they are NOT security acceptance criteria.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

process.env.NODE_ENV = 'production';
const { securityMiddleware } = require('../middleware/security');

async function withSyntheticApp(run) {
  const app = express();
  // This order mirrors the real app.js: security gate, then body parser,
  // then routers. Do not move broad SQLi/XSS regexes after parsing here.
  app.use(securityMiddleware);
  app.use(express.json({ limit: '10mb' }));

  app.post('/api/fixture', (req, res) => {
    res.json({ reached: true, hasBody: Boolean(req.body?.text) });
  });

  const router = express.Router();
  router.get('/item/:id', (req, res) => {
    res.json({ reached: true, hasParam: Boolean(req.params.id) });
  });
  app.use('/api/fixture', router);

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    await run('http://127.0.0.1:' + server.address().port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

test('GH-186 baseline: app.js mounts security before JSON/body and route handlers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const securityAt = source.indexOf('app.use(securityMiddleware);');
  const jsonAt = source.indexOf("app.use(express.json({ limit: '10mb' }));");
  const authRouterAt = source.indexOf("app.use('/api/auth', authLimiter, authRoutes);");

  assert.ok(securityAt !== -1 && jsonAt !== -1 && authRouterAt !== -1);
  assert.ok(securityAt < jsonAt && jsonAt < authRouterAt);
});

test('GH-186 baseline: malformed SQL-like query is rejected before route', async () => {
  await withSyntheticApp(async baseUrl => {
    const response = await fetch(baseUrl + '/api/fixture/item/clean?q=' + encodeURIComponent('1 OR 1=1'));
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.error, 'Input non valido');
  });
});

test('GH-186 KNOWN GAP: JSON body is parsed only after the global regex gate', async () => {
  await withSyntheticApp(async baseUrl => {
    const response = await fetch(baseUrl + '/api/fixture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '1 OR 1=1' })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reached: true, hasBody: true });
  });
});

test('GH-186 KNOWN GAP: route params are populated after the global regex gate', async () => {
  await withSyntheticApp(async baseUrl => {
    const response = await fetch(baseUrl + '/api/fixture/item/' + encodeURIComponent('SELECT'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reached: true, hasParam: true });
  });
});

test('GH-186 false-positive boundary: ordinary political prose with SELECT / UPDATE is accepted in JSON', async () => {
  await withSyntheticApp(async baseUrl => {
    const response = await fetch(baseUrl + '/api/fixture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Nel dibattito si citano SELECT e UPDATE, senza chiedere comandi SQL.' })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).hasBody, true);
  });
});

test('GH-186 false-positive risk: broad query regex rejects ordinary text containing SELECT', async () => {
  await withSyntheticApp(async baseUrl => {
    const response = await fetch(baseUrl + '/api/fixture/item/clean?search=' + encodeURIComponent('Vorrei discutere di SELECT'));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Input non valido');
  });
});
