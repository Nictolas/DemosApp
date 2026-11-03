const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const auditPath = require.resolve(path.join(ROOT, 'services', 'auditService.js'));
const ledgerPath = require.resolve(path.join(ROOT, 'services', 'privacyErasureLedgerService.js'));
const routePath = require.resolve(path.join(ROOT, 'routes', 'user', 'political-opinions-consent.js'));

const EVENT_TYPES = Object.freeze({
  POLITICAL_CONSENT_GRANTED: 'political_consent_granted',
  POLITICAL_CONSENT_REVOKED: 'political_consent_revoked'
});

async function serveConsentRoute({ query, sequence, ledgerEvents }, fn) {
  const originals = new Map([
    [authPath, require.cache[authPath]],
    [auditPath, require.cache[auditPath]],
    [ledgerPath, require.cache[ledgerPath]],
    [routePath, require.cache[routePath]]
  ]);

  const client = {
    query,
    release() {
      sequence.push('RELEASE');
    }
  };
  const pool = {
    async connect() {
      sequence.push('CONNECT');
      return client;
    },
    query
  };

  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      pool,
      verifyToken: (req, _res, next) => {
        req.userId = 'u-consent';
        next();
      }
    }
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      async logAction(payload) {
        sequence.push(`AUDIT:${payload.action}:${payload.success}`);
      }
    }
  };
  require.cache[ledgerPath] = {
    id: ledgerPath,
    filename: ledgerPath,
    loaded: true,
    exports: {
      EVENT_TYPES,
      async recordEvent(_client, event) {
        sequence.push(`LEDGER:${event.eventType}`);
        ledgerEvents.push(event);
      },
      async deleteByAnyColumn(dbClient, table, _columns, userId) {
        if (table !== 'opinioni_risposte') return 0;
        const result = await dbClient.query('DELETE FROM opinioni_risposte WHERE user_id = $1', [userId]);
        return result.rowCount || 0;
      },
      async tableHasColumn() {
        return false;
      }
    }
  };
  delete require.cache[routePath];

  const router = require(routePath);
  const app = express();
  app.use(express.json());
  app.use('/', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [modulePath, cached] of originals) {
      if (cached) require.cache[modulePath] = cached;
      else delete require.cache[modulePath];
    }
  }
}

function normalized(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

test('grant records durable privacy state inside the same transaction before commit', async () => {
  const sequence = [];
  const ledgerEvents = [];
  const query = async (sql) => {
    const s = normalized(sql);
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) {
      sequence.push(s);
      return { rows: [], rowCount: 0 };
    }
    if (s.startsWith('UPDATE users SET political_opinions_consent = $1')) {
      sequence.push('UPDATE_USERS_GRANTED');
      return {
        rows: [{ political_opinions_consent: true, political_opinions_consent_timestamp: '2026-10-12T10:00:00Z' }],
        rowCount: 1
      };
    }
    if (s.startsWith('INSERT INTO user_consents')) {
      sequence.push('UPSERT_CONSENT_GRANTED');
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${s}`);
  };

  await serveConsentRoute({ query, sequence, ledgerEvents }, async (base) => {
    const response = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'consent-test' },
      body: JSON.stringify({ consent: true })
    });
    assert.equal(response.status, 200);
  });

  assert.equal(ledgerEvents.length, 1);
  assert.equal(ledgerEvents[0].eventType, EVENT_TYPES.POLITICAL_CONSENT_GRANTED);
  assert.ok(sequence.indexOf('LEDGER:political_consent_granted') < sequence.indexOf('COMMIT'));
});

test('revocation deletes political opinions and records revocation before committing', async () => {
  const sequence = [];
  const ledgerEvents = [];
  const query = async (sql) => {
    const s = normalized(sql);
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) {
      sequence.push(s);
      return { rows: [], rowCount: 0 };
    }
    if (s.startsWith('UPDATE users SET political_opinions_consent = false')) {
      sequence.push('UPDATE_USERS_REVOKED');
      return { rows: [{ id: 'u-consent' }], rowCount: 1 };
    }
    if (s.startsWith('INSERT INTO user_consents')) {
      sequence.push('UPSERT_CONSENT_REVOKED');
      return { rows: [], rowCount: 1 };
    }
    if (s.includes('FROM information_schema.columns response_cols')) {
      return { rows: [], rowCount: 0 };
    }
    if (s.startsWith('SELECT EXISTS') && s.includes("table_name = 'opinioni_risposte'")) {
      sequence.push('CHECK_OPINIONS_TABLE');
      return { rows: [{ exists: true }], rowCount: 1 };
    }
    if (s.startsWith('DELETE FROM opinioni_risposte')) {
      sequence.push('DELETE_OPINIONS');
      return { rows: [], rowCount: 2 };
    }
    throw new Error(`Unexpected query: ${s}`);
  };

  await serveConsentRoute({ query, sequence, ledgerEvents }, async (base) => {
    const response = await fetch(`${base}/revoke`, { method: 'PUT', headers: { 'user-agent': 'consent-test' } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.consent.granted, false);
  });

  assert.equal(ledgerEvents.length, 1);
  assert.equal(ledgerEvents[0].eventType, EVENT_TYPES.POLITICAL_CONSENT_REVOKED);
  assert.equal(ledgerEvents[0].details.political_records_deleted_count, 2);
  assert.deepEqual(ledgerEvents[0].details.deleted_by_table, { opinioni_risposte: 2 });
  assert.ok(sequence.indexOf('DELETE_OPINIONS') < sequence.indexOf('LEDGER:political_consent_revoked'));
  assert.ok(sequence.indexOf('LEDGER:political_consent_revoked') < sequence.indexOf('COMMIT'));
});

test('opinion deletion failure rolls back revocation and never records a durable revoke event', async () => {
  const sequence = [];
  const ledgerEvents = [];
  const query = async (sql) => {
    const s = normalized(sql);
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) {
      sequence.push(s);
      return { rows: [], rowCount: 0 };
    }
    if (s.startsWith('UPDATE users SET political_opinions_consent = false')) {
      sequence.push('UPDATE_USERS_REVOKED');
      return { rows: [{ id: 'u-consent' }], rowCount: 1 };
    }
    if (s.startsWith('INSERT INTO user_consents')) {
      sequence.push('UPSERT_CONSENT_REVOKED');
      return { rows: [], rowCount: 1 };
    }
    if (s.includes('FROM information_schema.columns response_cols')) {
      return { rows: [], rowCount: 0 };
    }
    if (s.startsWith('SELECT EXISTS') && s.includes("table_name = 'opinioni_risposte'")) {
      sequence.push('CHECK_OPINIONS_TABLE');
      return { rows: [{ exists: true }], rowCount: 1 };
    }
    if (s.startsWith('DELETE FROM opinioni_risposte')) {
      sequence.push('DELETE_OPINIONS_FAIL');
      throw new Error('simulated delete failure');
    }
    throw new Error(`Unexpected query: ${s}`);
  };

  await serveConsentRoute({ query, sequence, ledgerEvents }, async (base) => {
    const response = await fetch(`${base}/revoke`, { method: 'PUT', headers: { 'user-agent': 'consent-test' } });
    assert.equal(response.status, 500);
  });

  assert.equal(ledgerEvents.length, 0);
  assert.equal(sequence.includes('ROLLBACK'), true);
  assert.equal(sequence.includes('COMMIT'), false);
});


// The status UI needs only grant+timestamp. The original audit IP/user-agent
// remain stored for GDPR evidence but must not be re-fetched/transmitted in GET.
test('GET consent minimizes audit metadata and disables caching without changing response keys', async () => {
  const sequence = [];
  const stamp = '2026-10-12T10:00:00Z';
  const query = async (sql, params) => {
    const statement = normalized(sql);
    assert.match(statement, /^SELECT COALESCE\(uc\.political_opinions_consent,/);
    assert.doesNotMatch(statement, /political_opinions_consent_ip_address|political_opinions_consent_user_agent/);
    assert.deepEqual(params, ['u-consent']);
    sequence.push('READ_CONSENT_STATUS_ONLY');
    return {
      rows: [{
        political_opinions_consent: true,
        political_opinions_consent_timestamp: stamp,
        // If a DB mock accidentally includes private fields, the API still
        // must fail closed rather than transmitting them to the WebView.
        political_opinions_consent_ip_address: '198.51.100.23',
        political_opinions_consent_user_agent: 'sensitive-audit-test'
      }]
    };
  };
  await serveConsentRoute({ query, sequence, ledgerEvents: [] }, async (base) => {
    const response = await fetch(base, { headers: { 'cache-control': 'no-cache' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') || '', /private.*no-store/);
    const body = await response.json();
    assert.deepEqual(body, {
      success: true,
      consent: { granted: true, timestamp: stamp, ipAddress: null, userAgent: null }
    });
    assert.doesNotMatch(JSON.stringify(body), /198\.51\.100\.23|sensitive-audit-test/);
  });
  assert.deepEqual(sequence, ['READ_CONSENT_STATUS_ONLY']);
});
