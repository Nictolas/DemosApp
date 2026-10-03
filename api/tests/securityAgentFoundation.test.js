const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SecurityCollector,
  DetectionEngine,
  IncidentManager,
  ShadowSecurityPipeline,
  normalizeSecurityEvent,
  adaptLegacySecurityRecord,
  adaptLegacyViolation
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

test('invalid event timestamps are rejected instead of producing corrupt telemetry', () => {
  assert.throws(() => normalizeSecurityEvent({
    source: 'test',
    type: 'bad.time',
    timestamp: 'not-a-date'
  }), /timestamp must be valid/);
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
  const failedLoginFinding = findings.find(finding => finding.ruleId === 'DET-AUTH-FAILED-BURST');
  assert.ok(failedLoginFinding);
  assert.equal(failedLoginFinding.severity, 'high');
  assert.equal(failedLoginFinding.count, 10);
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

test('legacy Axiom security records are mapped without identity/network identifiers', () => {
  const event = adaptLegacySecurityRecord({
    _time: '2026-10-03T12:00:00.000Z',
    type: 'failed_login',
    severity: 'medium',
    user_id: 'user-123',
    user_email: 'person@example.org',
    ip_address: '203.0.113.10',
    session_id: 'security-secret',
    details: {
      attempt_count: 4,
      time_window: '15_minutes',
      message: 'user person@example.org failed'
    }
  }, { environment: 'test' });

  assert.equal(event.type, 'login.failed');
  assert.equal(event.category, 'auth');
  assert.deepEqual(event.meta, {
    attemptCount: 4,
    timeWindow: '15_minutes'
  });

  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /user-123|person@example|203\.0\.113\.10|security-secret/);
});

test('legacy violations are mapped to privacy-safe events and discard raw descriptions', () => {
  const event = adaptLegacyViolation({
    type: 'UNAUTHORIZED_ACCESS',
    severity: 'HIGH',
    description: 'Accesso non autorizzato ai dati di utente user-sensitive-id',
    details: {
      user_id: 'actor-1',
      ip_address: '198.51.100.5',
      target_user: 'user-sensitive-id',
      access_count: '7'
    },
    timestamp: '2026-10-03T12:00:00.000Z'
  }, { environment: 'test' });

  assert.equal(event.type, 'access.unauthorized');
  assert.equal(event.category, 'access');
  assert.equal(event.severity, 'high');
  assert.deepEqual(event.meta, { accessCount: 7 });
  assert.doesNotMatch(JSON.stringify(event), /actor-1|198\.51\.100\.5|user-sensitive-id/);
});

test('shadow pipeline converts a real Demos failed-login burst into one incident', async () => {
  const pipeline = new ShadowSecurityPipeline();
  const now = new Date('2026-10-03T12:00:00.000Z');
  const records = Array.from({ length: 10 }, (_, index) => ({
    _time: new Date(now.getTime() - index * 1000).toISOString(),
    type: 'failed_login',
    severity: 'medium',
    user_id: `user-${index}`,
    ip_address: `203.0.113.${index + 1}`
  }));

  const result = await pipeline.ingestLegacySecurityRecords(records, {
    environment: 'test',
    now
  });

  assert.equal(result.acceptedCount, 10);
  assert.equal(result.duplicateCount, 0);
  assert.ok(result.findings.some(finding => finding.ruleId === 'DET-AUTH-FAILED-BURST'));
  assert.ok(result.incidents.some(incident => incident.ruleId === 'DET-AUTH-FAILED-BURST'));
  assert.equal(pipeline.snapshot().incidents.filter(i => i.ruleId === 'DET-AUTH-FAILED-BURST').length, 1);
});

test('shadow pipeline ignores duplicate records across repeated read-only polls', async () => {
  const pipeline = new ShadowSecurityPipeline();
  const now = new Date('2026-10-03T12:00:00.000Z');
  const record = {
    _time: '2026-10-03T11:59:59.000Z',
    type: 'failed_login',
    severity: 'medium',
    user_id: 'different-identities-must-not-matter'
  };

  const first = await pipeline.ingestLegacySecurityRecords([record], { now });
  const second = await pipeline.ingestLegacySecurityRecords([record], { now });

  assert.equal(first.acceptedCount, 1);
  assert.equal(second.acceptedCount, 0);
  assert.equal(second.duplicateCount, 1);
  assert.equal(pipeline.snapshot().events.length, 1);
});

test('suspicious request emitted by existing Demos monitor creates a critical finding', async () => {
  const pipeline = new ShadowSecurityPipeline();
  const now = new Date('2026-10-03T12:00:00.000Z');

  const result = await pipeline.ingestLegacySecurityRecords([{
    _time: '2026-10-03T11:59:59.000Z',
    type: 'suspicious_request',
    severity: 'high',
    ip_address: '203.0.113.99',
    details: {
      url: '/ignored',
      method: 'POST',
      body_keys: ['ignored']
    }
  }], { now });

  const finding = result.findings.find(item => item.ruleId === 'DET-SUSPICIOUS-REQUEST');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
});

test('legacy unauthorized-access detector feeds the new incident manager without linkage data', async () => {
  const pipeline = new ShadowSecurityPipeline();
  const now = new Date('2026-10-03T12:00:00.000Z');

  const result = await pipeline.ingestLegacyViolations([{
    type: 'UNAUTHORIZED_ACCESS',
    severity: 'HIGH',
    description: 'contains raw target that must be discarded',
    details: {
      user_id: 'actor-secret',
      target_user: 'target-secret',
      ip_address: '192.0.2.4',
      access_count: 5
    },
    timestamp: '2026-10-03T11:59:00.000Z'
  }], { now });

  assert.ok(result.findings.some(item => item.ruleId === 'DET-UNAUTHORIZED-ACCESS'));
  const snapshot = JSON.stringify(pipeline.snapshot());
  assert.doesNotMatch(snapshot, /actor-secret|target-secret|192\.0\.2\.4|raw target/);
});
