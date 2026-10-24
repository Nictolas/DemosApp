'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const ROOT = path.resolve(__dirname, '..');
const routePath = require.resolve(path.join(ROOT, 'routes/user/political-opinions-consent.js'));
const authPath = require.resolve(path.join(ROOT, 'middleware/auth.js'));
const auditPath = require.resolve(path.join(ROOT, 'services/auditService.js'));
const ledgerPath = require.resolve(path.join(ROOT, 'services/privacyErasureLedgerService.js'));
const servicePath = require.resolve(path.join(ROOT, 'services/politicalConsentService.js'));

function requirePrivateNoStore(response) {
  const value = response.headers.get('cache-control') || '';
  assert.match(value, /(?:^|,\s*)private(?:,|$)/);
  assert.match(value, /(?:^|,\s*)no-store(?:,|$)/);
}

test('real consent router prevents HTTP caching before authentication and on every error', async () => {
  const paths = [routePath, authPath, auditPath, ledgerPath, servicePath];
  const cached = new Map(paths.map(p => [p, require.cache[p]]));
  let mode = 'granted';
  let databaseReads = 0;
  let server;
  const pool = {
    async query(sql) {
      databaseReads++;
      assert.match(String(sql), /FROM users u/);
      assert.doesNotMatch(String(sql), /political_opinions_consent_(?:ip_address|user_agent)/, 'read only fields needed by the UI');
      if (mode === 'fail') throw new Error('synthetic database error');
      if (mode === 'missing') return { rows: [] };
      return { rows: [{
        political_opinions_consent: true,
        political_opinions_consent_timestamp: '2026-10-25T00:00:00Z',
        political_opinions_consent_ip_address: '198.51.100.20',
        political_opinions_consent_user_agent: 'synthetic-agent'
      }] };
    },
    async connect() { throw new Error('Test must never write to a database'); }
  };
  function mock(p, exports) {
    require.cache[p] = { id: p, filename: p, loaded: true, exports };
  }
  try {
    mock(authPath, {
      pool,
      verifyToken(req, res, next) {
        if (req.get('authorization') !== 'Bearer synthetic') {
          return res.status(401).json({ success: false, error: 'Non autenticato' });
        }
        req.userId = 'synthetic-user';
        next();
      }
    });
    mock(auditPath, { logAction: async () => {} });
    mock(ledgerPath, { EVENT_TYPES: {} });
    mock(servicePath, { cleanupConsentScopedPoliticalData: async () => ({totalDeleted: 0}) });
    delete require.cache[routePath];
    const router = require(routePath);
    const app = express();
    app.use(express.json());
    app.use('/api/user/political-opinions-consent', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api/user/political-opinions-consent';
    const authorized = { authorization: 'Bearer synthetic' };

    let res = await fetch(base);
    assert.equal(res.status, 401);
    requirePrivateNoStore(res);
    assert.equal(databaseReads, 0);

    res = await fetch(base, { headers: authorized });
    assert.equal(res.status, 200);
    requirePrivateNoStore(res);
    const data = await res.json();
    assert.equal(data.consent.granted, true);
    assert.deepEqual(Object.keys(data.consent).sort(), ['granted', 'timestamp']);
    assert.equal(data.consent.timestamp, '2026-10-25T00:00:00Z');
    assert.equal(JSON.stringify(data).includes('198.51.100.20'), false, 'IP must not reach the browser');
    assert.equal(JSON.stringify(data).includes('synthetic-agent'), false, 'user-agent must not reach the browser');

    mode = 'missing';
    res = await fetch(base, { headers: authorized });
    assert.equal(res.status, 404);
    requirePrivateNoStore(res);

    mode = 'fail';
    res = await fetch(base, { headers: authorized });
    assert.equal(res.status, 500);
    requirePrivateNoStore(res);

    const readsBeforeValidation = databaseReads;
    res = await fetch(base, {
      method: 'POST',
      headers: { ...authorized, 'content-type': 'application/json' },
      body: JSON.stringify({ consent: false })
    });
    assert.equal(res.status, 400);
    requirePrivateNoStore(res);
    assert.equal(databaseReads, readsBeforeValidation);

    res = await fetch(base + '/revoke', { method: 'PUT' });
    assert.equal(res.status, 401);
    requirePrivateNoStore(res);

    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(appSource, /app\.use\('\/api\/user\/political-opinions-consent', userLimiter, politicalOpinionsConsentRoutes\)/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [p, original] of cached) {
      if (original) require.cache[p] = original;
      else delete require.cache[p];
    }
  }
});
