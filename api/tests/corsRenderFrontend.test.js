const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const allowlists = [...appSource.matchAll(/const allowedOrigins = \[([\s\S]*?)\];/g)].map(match => match[1]);

test('official Render frontend is explicitly trusted by all three active CORS checks', () => {
  assert.equal(allowlists.length, 3, 'keep callback, middleware, and preflight policy in sync');

  for (const entries of allowlists) {
    assert.match(entries, /'https:\/\/demos-frontend-r3so\.onrender\.com'/);
    assert.match(entries, /'https:\/\/www\.demos\.community'/);
    assert.match(entries, /'https:\/\/demos\.community'/);
    assert.doesNotMatch(entries, /\*\.onrender\.com|\*/);
  }
});

test('unknown Render domains are not implicitly trusted', () => {
  for (const entries of allowlists) {
    assert.doesNotMatch(entries, /attacker\.onrender\.com/);
    assert.doesNotMatch(entries, /'https:\/\/\.onrender\.com'/);
  }
});

test('Idempotency-Key is permitted by CORS middleware and both preflight/header paths', () => {
  const configured = appSource.match(/allowedHeaders:\s*\[([^\]]+)\]/);
  assert.ok(configured, 'cors middleware must explicitly name request headers');
  assert.match(configured[1], /'Idempotency-Key'/);
  assert.match(configured[1], /'Authorization'/);
  assert.doesNotMatch(configured[1], /['"]\*['"]/);

  const headerResponses = [...appSource.matchAll(
    /res\.header\('Access-Control-Allow-Headers',\s*'([^']+)'\)/g
  )].map(match => match[1]);
  assert.equal(headerResponses.length, 2,
    'keep regular response and OPTIONS preflight allow-header policies aligned');
  for (const headers of headerResponses) {
    const entries = headers.split(',').map(value => value.trim().toLowerCase());
    assert.ok(entries.includes('idempotency-key'),
      'credentialed browser retries need an explicitly permitted Idempotency-Key');
    assert.ok(entries.includes('authorization'));
    assert.ok(entries.includes('content-type'));
    assert.ok(!entries.includes('*'), 'no wildcard headers with credentials');
  }
});
