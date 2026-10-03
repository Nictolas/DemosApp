const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SecurityCollector,
  DetectionEngine,
  IncidentManager,
  normalizeSecurityEvent
} = require('../security-agent');

test('security events drop sensitive/linkable metadata by default', () => {
  const event = normalizeSecurityEvent({
    source: 'demos-backend',
    type: 'login.failed',
    category: 'auth',
    severity: 'medium',
    environment: 'test',
    asset: 'api',
    meta: {
      route: '/api/login',
      statusCode: 401,
      userId: 'user-123',
      account_id: 'account-123',
      participant_id: 'participant-123',
      email: 'person@example.org',
      token: 'secret-token',
      opinionVector: 'sensitive',
      password: 'never-log-me'
    }
  });

  assert.deepEqual(event.meta, {
    route: '/api/login',
    statusCode: 401
  });
});

test('collector keeps a bounded read-only shadow buffer', async () => {
  const collector = new SecurityCollector({ maxBufferSize: 2 });
  await collector.collect({ source: 'render', type: 'one', category: 'test', severity: 'info' });
  await collector.collect({ source: 'render', type: 'two', category: 'test', severity: 'info' });
  await collector.collect({ source: 'render', type: 'three', category: 'test', severity: 'info' });

  const snapshot = collector.snapshot();
  assert.equal(snapshot.length, 2);
  assert.equal(snapshot[0].type, 'two');
  assert.equal(snapshot[1].type, 'three');
});

test('detection engine raises deterministic alert on failed-login burst', async () => {
  const collector = new SecurityCollector();
  const now = new Date('2026-10-03T12:00:00.000Z');

  for (let i = 0; i < 10; i += 1) {
    await collector.collect({
      source: 'demos-backend',
      type: 'login.failed',
      category: 'auth',
      severity: 'medium',
      timestamp: new Date(now.getTime() - i * 1000).toISOString()
    });
  }

  const findings = new DetectionEngine().evaluate(collector.snapshot(), now);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'DET-AUTH-FAILED-BURST');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].count, 10);
});

test('incident manager deduplicates the same deterministic finding', () => {
  const manager = new IncidentManager();
  const now = new Date('2026-10-03T12:00:00.000Z');
  const finding = {
    findingId: 'DET-X:1',
    ruleId: 'DET-X',
    title: 'Example finding',
    severity: 'high',
    count: 5,
    firstSeen: now.toISOString(),
    lastSeen: now.toISOString(),
    eventIds: ['e1']
  };

  const first = manager.ingest([finding], now);
  const second = manager.ingest([{ ...finding, count: 7 }], new Date(now.getTime() + 1000));

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0].incidentId, second[0].incidentId);
  assert.equal(manager.list().length, 1);
  assert.equal(manager.list()[0].count, 7);
});

test('incident lifecycle is explicit and reversible at metadata level', () => {
  const manager = new IncidentManager();
  const [incident] = manager.ingest([{
    findingId: 'DET-Y:1',
    ruleId: 'DET-Y',
    title: 'Example incident',
    severity: 'medium',
    count: 1,
    firstSeen: '2026-10-03T12:00:00.000Z',
    lastSeen: '2026-10-03T12:00:00.000Z',
    eventIds: ['e1']
  }]);

  assert.equal(manager.acknowledge(incident.incidentId).status, 'acknowledged');
  assert.equal(manager.resolve(incident.incidentId).status, 'resolved');
});
