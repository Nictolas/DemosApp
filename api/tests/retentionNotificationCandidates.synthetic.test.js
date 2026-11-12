const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSyntheticJob({ candidates = [], fail = false, auditFail = false, cleanupFail = false } = {}) {
  const actions = [];
  const messages = [];
  const service = {
    async performFullCleanup() {
      if (cleanupFail) throw new Error('synthetic-cleanup-secret-do-not-emit');
      return { totalDeleted: 0, deletedCounts: {}, errors: [] };
    },
    async sendRetentionNotifications(daysBefore) {
      assert.equal(daysBefore, 30);
      if (fail) throw new Error('synthetic-db-error-do-not-emit');
      return candidates;
    }
  };
  const audit = { async logAction(entry) { if (auditFail) throw new Error('synthetic-audit-secret-do-not-emit'); actions.push(entry); } };
  const sandbox = {
    module: { exports: {} },
    require(name) {
      if (name === '../services/dataRetentionService') return service;
      if (name === '../services/auditService') return audit;
      throw new Error('Unexpected dependency ' + name);
    },
    console: {
      log(...args) { messages.push(args.map(String).join(' ')); },
      error(...args) { messages.push(args.map(String).join(' ')); },
      warn(...args) { messages.push(args.map(String).join(' ')); }
    },
    process: { env: {} },
    Date,
    Promise
  };
  const source = fs.readFileSync(path.join(__dirname, '../jobs/dataRetentionJob.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'dataRetentionJob.js' });
  return { job: sandbox.module.exports, actions, messages };
}

function loadSyntheticAdminRoute(candidates, { fail = false, logMessages = [] } = {}) {
  const handlers = {};
  const router = {
    use() { return this; },
    get(path, handler) { handlers['GET ' + path] = handler; return this; },
    post(path, handler) { handlers['POST ' + path] = handler; return this; },
    delete(path, handler) { handlers['DELETE ' + path] = handler; return this; }
  };
  const source = fs.readFileSync(path.join(__dirname, '../routes/admin/data-retention.js'), 'utf8');
  vm.runInNewContext(source, {
    module: { exports: {} },
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === '../../middleware/auth') return { verifyToken: () => {}, requireAdmin: () => {} };
      if (name === '../../jobs/dataRetentionJob') return {};
      if (name === '../../services/dataRetentionService') {
        return { async sendRetentionNotifications() {
          if (fail) throw new Error('synthetic-api-secret-do-not-emit');
          return candidates;
        } };
      }
      throw new Error('Unexpected dependency ' + name);
    },
    console: { error(...args) { logMessages.push(args.map(String).join(' ')); } },
    Date
  }, { filename: 'data-retention.js' });
  return handlers;
}

test('candidate scan records candidate_count and explicitly zero delivery', async () => {
  const { job, actions, messages } = loadSyntheticJob({
    candidates: [{ userId: 'synthetic-a' }, { userId: 'synthetic-b' }]
  });
  await job.sendWeeklyNotifications();
  assert.equal(actions.length, 1);
  const entry = actions[0];
  assert.equal(entry.action, 'DATA_RETENTION_NOTIFICATION_CANDIDATE_SCAN');
  assert.equal(entry.resource, 'retention_candidates');
  assert.equal(entry.success, true);
  assert.equal(entry.details.candidate_count, 2);
  assert.equal(entry.details.sent_count, 0);
  assert.equal(entry.details.delivery_performed, false);
  assert.equal(JSON.stringify(entry).includes('synthetic-a'), false);
  assert.equal(messages.some(m => /Inviate 2 notifiche/.test(m)), false);
  assert.ok(messages.some(m => /inviate: 0/.test(m)));
});

test('empty candidate scan does not emit a false sent notification event', async () => {
  const { job, actions, messages } = loadSyntheticJob();
  await job.sendWeeklyNotifications();
  assert.equal(actions.length, 0);
  assert.ok(messages.some(m => /inviate: 0/.test(m)));
});

test('failed candidate scan cannot claim successful delivery or disclose raw error in audit', async () => {
  const { job, actions } = loadSyntheticJob({ fail: true });
  await job.sendWeeklyNotifications();
  assert.equal(actions.length, 1);
  assert.equal(actions[0].success, false);
  assert.equal(actions[0].action, 'DATA_RETENTION_NOTIFICATION_CANDIDATE_SCAN');
  assert.equal(actions[0].details.sent_count, 0);
  assert.equal(actions[0].details.delivery_performed, false);
  assert.equal(JSON.stringify(actions[0]).includes('synthetic-db-error-do-not-emit'), false);
});

test('admin preview exposes explicit candidate and non-delivery contract without side effects', async () => {
  const handlers = loadSyntheticAdminRoute([{ userId: 'synthetic-a' }, { userId: 'synthetic-b' }]);
  const endpoint = handlers['GET /notifications'];
  assert.equal(typeof endpoint, 'function');
  let payload;
  await endpoint({ query: { daysBefore: '30' } }, {
    json(value) { payload = value; }
  });
  assert.equal(payload.success, true);
  assert.equal(payload.data.count, 2);
  assert.equal(payload.data.candidate_count, 2);
  assert.equal(payload.data.sent_count, 0);
  assert.equal(payload.data.delivery_performed, false);
  assert.equal(payload.data.delivery_status, 'not_sent');
  assert.equal(payload.data.notifications.length, 2);
});

test('source contains no retention-delivered audit event or positive sent count', () => {
  const job = fs.readFileSync(path.join(__dirname, '../jobs/dataRetentionJob.js'), 'utf8');
  assert.doesNotMatch(job, /action:\s*'DATA_RETENTION_NOTIFICATIONS'/);
  assert.doesNotMatch(job, /notification_count:\s*notifications\.length/);
  assert.doesNotMatch(job, /Inviate \$\{notifications\.length\}/);
});


test('scan failure does not disclose raw error in console or audit', async () => {
  const { job, actions, messages } = loadSyntheticJob({ fail: true });
  await job.sendWeeklyNotifications();
  assert.equal(actions.length, 1);
  assert.equal(messages.join(' ').includes('synthetic-db-error-do-not-emit'), false);
  assert.ok(messages.some(m => m.includes('RETENTION_CANDIDATE_SCAN_FAILED')));
});

test('double failure: scan and audit both fail without leaking raw errors', async () => {
  const { job, messages } = loadSyntheticJob({ fail: true, auditFail: true });
  await assert.doesNotReject(() => job.sendWeeklyNotifications());
  const output = messages.join(' ');
  assert.equal(output.includes('synthetic-db-error-do-not-emit'), false);
  assert.equal(output.includes('synthetic-audit-secret-do-not-emit'), false);
  assert.match(output, /RETENTION_CANDIDATE_AUDIT_FAILED/);
});

test('audit failure after successful enumeration is not mistaken for delivery', async () => {
  const { job, messages } = loadSyntheticJob({ candidates: [{ userId: 'fixture' }], auditFail: true });
  await assert.doesNotReject(() => job.sendWeeklyNotifications());
  assert.equal(messages.join(' ').includes('synthetic-audit-secret-do-not-emit'), false);
  assert.ok(messages.some(m => m.includes('RETENTION_CANDIDATE_AUDIT_FAILED')));
});

test('daily retention cleanup never writes raw SQL errors to console or audit', async () => {
  const { job, actions, messages } = loadSyntheticJob({ cleanupFail: true });
  await assert.doesNotReject(() => job.performDailyCleanup());
  assert.equal(actions.length, 1);
  assert.equal(actions[0].success, false);
  assert.equal(actions[0].details.error_code, 'RETENTION_DAILY_CLEANUP_FAILED');
  assert.equal(actions[0].errorMessage, 'RETENTION_DAILY_CLEANUP_FAILED');
  assert.doesNotMatch(messages.join(' ') + JSON.stringify(actions), /synthetic-cleanup-secret-do-not-emit/);
  assert.match(messages.join(' '), /RETENTION_DAILY_CLEANUP_FAILED/);
});

test('immediate cleanup preserves error behavior without logging private diagnostics', async () => {
  const { job, messages } = loadSyntheticJob({ cleanupFail: true });
  await assert.rejects(() => job.performImmediateCleanup(), /synthetic-cleanup-secret-do-not-emit/);
  assert.doesNotMatch(messages.join(' '), /synthetic-cleanup-secret-do-not-emit/);
  assert.match(messages.join(' '), /RETENTION_IMMEDIATE_CLEANUP_FAILED/);
});

test('admin candidate failure exposes only generic HTTP error and static log code', async () => {
  const logs = [];
  const handler = loadSyntheticAdminRoute([], { fail: true, logMessages: logs })['GET /notifications'];
  let status, body;
  const response = {
    status(value) { status = value; return this; },
    json(value) { body = value; return this; }
  };
  await handler({ query: { daysBefore: '30' } }, response);
  assert.equal(status, 500);
  assert.equal(body.success, false);
  assert.doesNotMatch(logs.join(' ') + JSON.stringify(body), /synthetic-api-secret-do-not-emit/);
  assert.match(logs.join(' '), /RETENTION_NOTIFICATION_CANDIDATES_FAILED/);
});

test('all retention route/job console error sites use static codes, no raw exception object', () => {
  for (const file of ['../jobs/dataRetentionJob.js', '../routes/admin/data-retention.js']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.doesNotMatch(source, /console\.error\([^\n]*,\s*(?:error|err|e)(?:\.message)?\s*\)/);
  }
  const jobSource = fs.readFileSync(path.join(__dirname, '../jobs/dataRetentionJob.js'), 'utf8');
  assert.doesNotMatch(jobSource, /errorMessage:\s*error\.message|error:\s*error\.message/);
});
