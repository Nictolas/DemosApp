const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PostgresSecurityStore } = require('../security-agent/postgresSecurityStore');

function makePool() {
  const calls = [];
  const pool = {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/INSERT INTO security_agent\.incidents/.test(sql)) {
        return { rows: [{
          incident_id: params[0], finding_id: params[1], rule_id: params[2], severity: params[3], status: params[4], event_count: params[5],
          first_seen: params[6], last_seen: params[7], created_at: params[8], updated_at: params[9]
        }] };
      }
      if (/FROM security_agent\.incidents/.test(sql) && /ORDER BY/.test(sql)) {
        return { rows: [{
          incident_id: 'inc-1', finding_id: 'find-1', rule_id: 'DET-X', severity: 'high', status: 'open', event_count: '3',
          first_seen: '2026-10-03T10:00:00Z', last_seen: '2026-10-03T10:01:00Z', created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T10:01:00Z'
        }] };
      }
      if (/INSERT INTO security_agent\.source_state/.test(sql)) {
        return { rows: [{
          source_name: params[0], enabled: params[1], watermark: params[2], last_poll_started_at: params[3], last_success_at: params[4],
          last_failure_at: params[5], consecutive_failures: params[6], total_polls: params[7], total_fetched: params[8], total_accepted: params[9],
          total_duplicates: params[10], stored_at: params[11]
        }] };
      }
      if (/FROM security_agent\.source_state/.test(sql) && /WHERE source_name/.test(sql)) return { rows: [] };
      if (/DELETE FROM security_agent\.incidents/.test(sql)) return { rowCount: 2, rows: [] };
      if (/incident_count/.test(sql)) return { rows: [{ incident_count: '4' }] };
      if (/source_count/.test(sql)) return { rows: [{ source_count: '1' }] };
      if (/GROUP BY severity/.test(sql)) return { rows: [{ severity: 'high', count: '2' }, { severity: 'critical', count: '1' }] };
      if (/GROUP BY status/.test(sql)) return { rows: [{ status: 'open', count: '3' }, { status: 'resolved', count: '1' }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async connect() {
      return {
        async query(sql, params = []) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            calls.push({ sql, params });
            return { rows: [] };
          }
          return pool.query(sql, params);
        },
        release() {}
      };
    }
  };
  return pool;
}

function incident(overrides = {}) {
  return {
    incidentId: 'inc-1', findingId: 'find-1', ruleId: 'DET-X', severity: 'high', status: 'open', count: 3,
    firstSeen: '2026-10-03T10:00:00Z', lastSeen: '2026-10-03T10:01:00Z', createdAt: '2026-10-03T10:00:00Z', updatedAt: '2026-10-03T10:01:00Z',
    title: 'must not persist', userId: 'user-secret', ip: '203.0.113.10', payload: { opinion: 'secret' },
    ...overrides
  };
}

test('durable store persists only allowlisted incident fields', async () => {
  const pool = makePool();
  const store = new PostgresSecurityStore({ pool });
  const [stored] = await store.upsertIncidents([incident()]);
  assert.equal(stored.incidentId, 'inc-1');
  const call = pool.calls.find(item => /INSERT INTO security_agent\.incidents/.test(item.sql));
  const serialized = JSON.stringify(call);
  assert.doesNotMatch(serialized, /must not persist|user-secret|203\.0\.113\.10|opinion|payload/);
  assert.match(call.sql, /security_agent\.incidents/);
});

test('incident filters are parameterized and bounded', async () => {
  const pool = makePool();
  const store = new PostgresSecurityStore({ pool });
  const rows = await store.listIncidents({ status: 'open', severity: 'high', limit: 25 });
  assert.equal(rows.length, 1);
  const call = pool.calls.find(item => /FROM security_agent\.incidents/.test(item.sql) && /ORDER BY/.test(item.sql));
  assert.deepEqual(call.params, ['open', 'high', 25]);
  assert.doesNotMatch(call.sql, /\bopen\b|\bhigh\b/);
  await assert.rejects(() => store.listIncidents({ status: 'DROP TABLE' }), /invalid status/);
  await assert.rejects(() => store.listIncidents({ limit: 5001 }), /limit/);
});

test('source state contains counters and timestamps only', async () => {
  const pool = makePool();
  const store = new PostgresSecurityStore({ pool });
  const state = await store.saveSourceState('axiom-security', {
    enabled: true,
    watermark: '2026-10-03T10:00:00Z',
    lastSuccessAt: '2026-10-03T10:00:00Z',
    totals: { polls: 2, fetched: 9, accepted: 8, duplicates: 1 },
    token: 'secret',
    endpoint: 'https://secret'
  }, new Date('2026-10-03T10:01:00Z'));
  assert.equal(state.totals.fetched, 9);
  const serialized = JSON.stringify(pool.calls.find(item => /INSERT INTO security_agent\.source_state/.test(item.sql)));
  assert.doesNotMatch(serialized, /secret|endpoint|token/);
});

test('prune uses retention threshold as a parameter', async () => {
  const pool = makePool();
  const store = new PostgresSecurityStore({ pool, retentionMs: 24 * 60 * 60 * 1000 });
  const removed = await store.prune({ now: new Date('2026-10-03T12:00:00Z') });
  assert.equal(removed, 2);
  const call = pool.calls.find(item => /DELETE FROM security_agent\.incidents/.test(item.sql));
  assert.deepEqual(call.params, ['2026-10-02T12:00:00.000Z']);
});

test('stats are aggregated server-side', async () => {
  const pool = makePool();
  const store = new PostgresSecurityStore({ pool });
  const stats = await store.stats();
  assert.deepEqual(stats, {
    incidentCount: 4,
    sourceCount: 1,
    bySeverity: { high: 2, critical: 1 },
    byStatus: { open: 3, resolved: 1 }
  });
  assert.equal(pool.calls.length, 4);
});

test('migration draft has isolated schema and no foreign keys to app domains', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../security-agent/migrations/001_security_store.sql'), 'utf8');
  const executable = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.match(executable, /CREATE SCHEMA IF NOT EXISTS security_agent/i);
  assert.match(executable, /CREATE TABLE IF NOT EXISTS security_agent\.incidents/i);
  assert.match(executable, /CREATE TABLE IF NOT EXISTS security_agent\.source_state/i);
  assert.doesNotMatch(executable, /\bREFERENCES\b/i);
  assert.doesNotMatch(executable, /\b(user_id|account_id|participant_id|email|ip_address|codice_fiscale)\b/i);
});

test('migration draft denies public app roles and uses NOLOGIN security roles', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../security-agent/migrations/001_security_store.sql'), 'utf8');
  assert.match(sql, /REVOKE ALL ON SCHEMA security_agent FROM PUBLIC/i);
  assert.match(sql, /demos_security_agent_writer NOLOGIN/i);
  assert.match(sql, /demos_security_center_reader NOLOGIN/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
});
