const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MemorySecurityStore,
  sanitizeIncidentForStore,
  ShadowSecurityRunner,
  createShadowSecurityRunner
} = require('../security-agent');

function incident(overrides = {}) {
  return {
    incidentId: 'inc-1',
    findingId: 'DET-X:1',
    ruleId: 'DET-X',
    title: 'raw title is intentionally not persisted',
    severity: 'high',
    status: 'open',
    count: 3,
    firstSeen: '2026-10-03T12:00:00.000Z',
    lastSeen: '2026-10-03T12:00:00.000Z',
    createdAt: '2026-10-03T12:00:00.000Z',
    updatedAt: '2026-10-03T12:00:00.000Z',
    rawEvent: { email: 'person@example.org' },
    ...overrides
  };
}

test('security store persists only minimal incident metadata', () => {
  const stored = sanitizeIncidentForStore(incident());
  const serialized = JSON.stringify(stored);
  assert.deepEqual(Object.keys(stored), [
    'incidentId', 'findingId', 'ruleId', 'severity', 'status', 'count',
    'firstSeen', 'lastSeen', 'createdAt', 'updatedAt'
  ]);
  assert.doesNotMatch(serialized, /title|rawEvent|person@example/);
});

test('memory store upserts incidents and keeps source state separate', () => {
  const store = new MemorySecurityStore();
  store.upsertIncidents([incident()]);
  store.upsertIncidents([incident({ count: 7, updatedAt: '2026-10-03T12:01:00.000Z' })]);
  store.saveSourceState('axiom-security', {
    enabled: true,
    watermark: '2026-10-03T12:00:30.000Z',
    totals: { polls: 2, fetched: 20, accepted: 10, duplicates: 10 },
    token: 'must-never-be-stored'
  });
  assert.equal(store.listIncidents().length, 1);
  assert.equal(store.listIncidents()[0].count, 7);
  assert.equal(store.getSourceState('axiom-security').totals.polls, 2);
  assert.doesNotMatch(JSON.stringify(store.getSourceState('axiom-security')), /token|must-never/);
});

test('memory store retention prunes old incident metadata', () => {
  const store = new MemorySecurityStore({ retentionMs: 60 * 60 * 1000 });
  store.upsertIncidents([incident({
    updatedAt: '2026-10-03T10:00:00.000Z',
    lastSeen: '2026-10-03T10:00:00.000Z'
  })]);
  const removed = store.prune({ now: new Date('2026-10-03T12:00:00.000Z') });
  assert.equal(removed, 1);
  assert.equal(store.listIncidents().length, 0);
});

test('runner is disabled by default and performs no source reads', async () => {
  let calls = 0;
  const source = {
    poll: async () => { calls += 1; return { status: 'ok' }; },
    checkHeartbeat: async () => ({ status: 'healthy', incidentCreated: false }),
    status: () => ({ enabled: true, totals: {} })
  };
  const runner = new ShadowSecurityRunner({ source });
  assert.equal((await runner.runOnce()).status, 'disabled');
  assert.equal(calls, 0);
  assert.equal(runner.start(), false);
});

test('enabled runner polls, heartbeats and stores only incident summaries', async () => {
  const store = new MemorySecurityStore();
  const source = {
    pipeline: { snapshot: () => ({ incidents: [incident()] }) },
    poll: async () => ({
      status: 'ok', fetched: 10, accepted: 10, duplicates: 0,
      watermark: '2026-10-03T11:59:59.000Z'
    }),
    checkHeartbeat: async () => ({ status: 'healthy', incidentCreated: false }),
    status: () => ({
      enabled: true,
      watermark: '2026-10-03T11:59:59.000Z',
      totals: { polls: 1, fetched: 10, accepted: 10, duplicates: 0 }
    })
  };
  const runner = new ShadowSecurityRunner({ source, store, enabled: true });
  const result = await runner.runOnce({ now: new Date('2026-10-03T12:00:00.000Z') });
  assert.equal(result.status, 'ok');
  assert.equal(result.storedIncidentCount, 1);
  assert.equal(store.listIncidents().length, 1);
  assert.doesNotMatch(JSON.stringify(store.listIncidents()), /raw title|person@example|rawEvent/);
});

test('runner refuses overlapping cycles', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const source = {
    poll: async () => { await gate; return { status: 'ok' }; },
    checkHeartbeat: async () => ({ status: 'healthy', incidentCreated: false }),
    status: () => ({ enabled: true, totals: {} })
  };
  const runner = new ShadowSecurityRunner({ source, enabled: true });
  const first = runner.runOnce({ now: new Date('2026-10-03T12:00:00.000Z') });
  const second = await runner.runOnce({ now: new Date('2026-10-03T12:00:01.000Z') });
  assert.equal(second.status, 'skipped_busy');
  release();
  assert.equal((await first).status, 'ok');
});

test('runner factory remains OFF unless explicitly enabled', async () => {
  let calls = 0;
  const source = {
    poll: async () => { calls += 1; return { status: 'ok' }; },
    checkHeartbeat: async () => ({ status: 'healthy', incidentCreated: false }),
    status: () => ({ enabled: true, totals: {} })
  };
  const runner = createShadowSecurityRunner({ source, env: { NODE_ENV: 'test' } });
  assert.equal(runner.status().enabled, false);
  assert.equal((await runner.runOnce()).status, 'disabled');
  assert.equal(calls, 0);
});

test('runner errors are reduced to a generic code', async () => {
  const source = {
    poll: async () => { throw new Error('secret database url and token'); },
    checkHeartbeat: async () => ({ status: 'healthy', incidentCreated: false }),
    status: () => ({ enabled: true, totals: {} })
  };
  const runner = new ShadowSecurityRunner({ source, enabled: true });
  const result = await runner.runOnce();
  assert.deepEqual(result, { status: 'error', errorCode: 'SECURITY_RUNNER_FAILED' });
  assert.doesNotMatch(JSON.stringify(result), /secret|database url|token/);
});
