const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'production';
const { securityMiddleware, securityLogger } = require('../middleware/security');

function makeReq({ query = {}, agent = 'safe-agent', size = '0' } = {}) {
  return {
    originalUrl: '/api/security-check?secret=synthetic-url-secret',
    url: '/api/security-check',
    method: 'GET',
    ip: '198.51.100.44',
    headers: {},
    body: {},
    query,
    params: {},
    get(name) {
      if (String(name).toLowerCase() === 'content-length') return size;
      if (String(name).toLowerCase() === 'user-agent') return agent;
      return undefined;
    }
  };
}

function makeRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; },
    send(body) { this.payload = body; return this; }
  };
}

function captureLogs(action) {
  const oldLog = console.log;
  const oldWarn = console.warn;
  const logs = [];
  console.log = (...args) => logs.push(args.map(String).join(' '));
  console.warn = (...args) => logs.push(args.map(String).join(' '));
  try {
    action();
  } finally {
    console.log = oldLog;
    console.warn = oldWarn;
  }
  return logs.join('\n');
}

const forbidden = [
  '198.51.100.44', 'synthetic-url-secret',
  'synthetic-user-agent-secret', 'synthetic-field-secret'
];

function expectOnlyStaticLogs(logs) {
  assert.ok(logs.length > 0, 'must retain a minimal security event');
  for (const value of forbidden) assert.equal(logs.includes(value), false);
}

test('403 User-Agent rejection does not log the header or IP', () => {
  const req = makeReq({ agent: 'sqlmap synthetic-user-agent-secret' });
  const res = makeRes();
  let called = false;
  const logs = captureLogs(() => securityMiddleware(req, res, () => { called = true; }));
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.match(logs, /SECURITY_USER_AGENT_REJECTED/);
  expectOnlyStaticLogs(logs);
});

test('413 content-length rejection does not log IP or user-controlled headers', () => {
  const req = makeReq({ size: '10485761', agent: 'synthetic-user-agent-secret' });
  const res = makeRes();
  const logs = captureLogs(() => securityMiddleware(req, res, () => assert.fail('must reject')));
  assert.equal(res.statusCode, 413);
  assert.match(logs, /SECURITY_REQUEST_SIZE_REJECTED/);
  expectOnlyStaticLogs(logs);
});

test('400 query rejection does not log attacker-controlled field names', () => {
  const req = makeReq({ query: { 'synthetic-field-secret': '1 OR 1=1' } });
  const res = makeRes();
  const logs = captureLogs(() => securityMiddleware(req, res, () => assert.fail('must reject')));
  assert.equal(res.statusCode, 400);
  assert.match(logs, /SECURITY_INPUT_SQL_REJECTED/);
  expectOnlyStaticLogs(logs);
});

test('4xx security logger retains status without method, URL, IP or User-Agent', () => {
  const req = makeReq({ agent: 'synthetic-user-agent-secret' });
  const res = makeRes();
  res.statusCode = 404;
  const logs = captureLogs(() => {
    securityLogger(req, res, () => {});
    res.send('synthetic response');
  });
  assert.match(logs, /SECURITY_HTTP_REJECTED 404/);
  expectOnlyStaticLogs(logs);
});

test('no request-controlled values are interpolated in middleware console logs', () => {
  const source = fs.readFileSync(path.join(__dirname, '../middleware/security.js'), 'utf8');
  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*(?:req\.ip|req\.originalUrl|userAgent|\$\{path\}\$\{key\})/);
  for (const code of ['SECURITY_RATE_LIMIT_REJECTED', 'SECURITY_USER_AGENT_REJECTED', 'SECURITY_REQUEST_SIZE_REJECTED']) {
    assert.ok(source.includes(code));
  }
});
