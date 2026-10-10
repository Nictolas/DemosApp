const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const {
  normalizeLimit,
  listPendingReconciliationCandidates,
  rejectReconciliationCandidate,
  reviewReconciliationCandidate,
} = require('../services/civicProcessReconciliationService');

test('reconciliation queue limit is bounded', () => {
  assert.equal(normalizeLimit(undefined), 100);
  assert.equal(normalizeLimit(0), 1);
  assert.equal(normalizeLimit(9999), 500);
  assert.equal(normalizeLimit(25), 25);
});

test('pending reconciliation queue exposes source and candidate process evidence only', async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql: String(sql), params });
    return { rows: [{ candidate_id: 'c1', source_record_id: 's1', candidate_process_id: 'p2' }] };
  } };
  const rows = await listPendingReconciliationCandidates(db, { limit: 12 });
  assert.equal(rows.length, 1);
  assert.equal(calls[0].params[0], 12);
  assert.match(calls[0].sql, /WHERE candidate\.status = 'pending'/);
  assert.match(calls[0].sql, /JOIN civic_process_source_records/);
  assert.match(calls[0].sql, /JOIN civic_processes source_process/);
  assert.match(calls[0].sql, /JOIN civic_processes target/);
});

test('reject decision records reviewer and does not merge processes', async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    const text = String(sql);
    calls.push({ text, params });
    if (/FROM civic_process_reconciliation_candidates candidate/.test(text)) {
      return { rows: [{ candidate_id: 'c1', status: 'pending', source_record_id: 's1', candidate_process_id: 'p2' }] };
    }
    return { rows: [], rowCount: 1 };
  } };
  const result = await rejectReconciliationCandidate(client, { candidateId: 'c1', reviewerUserId: 'admin-1' });
  assert.equal(result.decision, 'rejected');
  assert.equal(result.merged, false);
  const update = calls.find(call => /SET status = 'rejected'/.test(call.text));
  assert.ok(update);
  assert.deepEqual(update.params, ['c1', 'admin-1']);
  assert.ok(!calls.some(call => /UPDATE civic_process_source_records/.test(call.text)));
});

test('already reviewed candidate fails closed', async () => {
  const client = { query: async () => ({ rows: [{ candidate_id: 'c1', status: 'accepted', source_record_id: 's1', candidate_process_id: 'p2' }] }) };
  await assert.rejects(
    rejectReconciliationCandidate(client, { candidateId: 'c1', reviewerUserId: 'admin-1' }),
    /RECONCILIATION_CANDIDATE_ALREADY_REVIEWED/
  );
});

test('review wrapper commits a reject and always releases the client', async () => {
  const calls = [];
  let released = false;
  const client = {
    query: async (sql) => {
      const text = String(sql);
      calls.push(text);
      if (/FROM civic_process_reconciliation_candidates candidate/.test(text)) {
        return { rows: [{ candidate_id: 'c1', status: 'pending', source_record_id: 's1', candidate_process_id: 'p2' }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => { released = true; },
  };
  const pool = { connect: async () => client };
  const result = await reviewReconciliationCandidate(pool, { candidateId: 'c1', decision: 'reject', reviewerUserId: 'admin-1' });
  assert.equal(result.decision, 'rejected');
  assert.equal(calls[0], 'BEGIN');
  assert.equal(calls.at(-1), 'COMMIT');
  assert.equal(released, true);
});

test('admin reconciliation route is mounted and protected by verifyToken plus requireAdmin', () => {
  const route = fs.readFileSync(path.join(ROOT, 'api/routes/admin/civic-process-reconciliation.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'api/app.js'), 'utf8');
  assert.match(route, /router\.use\(verifyToken\)/);
  assert.match(route, /router\.use\(requireAdmin\)/);
  assert.match(route, /router\.get\('\/pending'/);
  assert.match(route, /router\.post\('\/:candidateId\/review'/);
  assert.match(app, /civicProcessReconciliationRoutes = require\('\.\/routes\/admin\/civic-process-reconciliation'\)/);
  assert.match(app, /app\.use\('\/api\/admin\/civic-process-reconciliation', adminLimiter, civicProcessReconciliationRoutes\)/);
});
