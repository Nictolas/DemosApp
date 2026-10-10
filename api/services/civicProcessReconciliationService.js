'use strict';

const { attachSourceRecordAfterReview } = require('./civicProcessPersistenceService');

function normalizeLimit(value, fallback = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(500, parsed));
}

async function listPendingReconciliationCandidates(db, { limit = 100 } = {}) {
  if (!db?.query) throw new Error('DATABASE_REQUIRED');
  const safeLimit = normalizeLimit(limit);
  const result = await db.query(
    `SELECT
       candidate.id::text AS candidate_id,
       candidate.reason,
       candidate.created_at,
       source.id::text AS source_record_id,
       source.source_id,
       source.external_id,
       source.source_title,
       source.source_url,
       source.source_stage,
       source.source_status,
       source_process.id::text AS source_process_id,
       source_process.canonical_title AS source_process_title,
       source_process.canonical_stage AS source_process_stage,
       target.id::text AS candidate_process_id,
       target.canonical_title AS candidate_process_title,
       target.canonical_stage AS candidate_process_stage,
       target.official_reference AS candidate_official_reference
     FROM civic_process_reconciliation_candidates candidate
     JOIN civic_process_source_records source ON source.id = candidate.source_record_id
     JOIN civic_processes source_process ON source_process.id = source.civic_process_id
     JOIN civic_processes target ON target.id = candidate.candidate_process_id
     WHERE candidate.status = 'pending'
     ORDER BY candidate.created_at ASC, candidate.id ASC
     LIMIT $1`,
    [safeLimit]
  );
  return result.rows;
}

async function loadCandidateForReview(client, candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) throw new Error('RECONCILIATION_CANDIDATE_ID_REQUIRED');
  const result = await client.query(
    `SELECT
       candidate.id::text AS candidate_id,
       candidate.status,
       candidate.source_record_id::text AS source_record_id,
       candidate.candidate_process_id::text AS candidate_process_id
     FROM civic_process_reconciliation_candidates candidate
     WHERE candidate.id::text = $1
     FOR UPDATE`,
    [id]
  );
  return result.rows[0] || null;
}

async function rejectReconciliationCandidate(client, { candidateId, reviewerUserId }) {
  if (!reviewerUserId) throw new Error('RECONCILIATION_REVIEWER_REQUIRED');
  const candidate = await loadCandidateForReview(client, candidateId);
  if (!candidate) throw new Error('RECONCILIATION_CANDIDATE_NOT_FOUND');
  if (candidate.status !== 'pending') throw new Error('RECONCILIATION_CANDIDATE_ALREADY_REVIEWED');

  await client.query(
    `UPDATE civic_process_reconciliation_candidates
        SET status = 'rejected',
            reviewed_by_user_id = $2,
            reviewed_at = NOW()
      WHERE id::text = $1`,
    [candidate.candidate_id, reviewerUserId]
  );

  return Object.freeze({
    candidateId: candidate.candidate_id,
    sourceRecordId: candidate.source_record_id,
    targetProcessId: candidate.candidate_process_id,
    decision: 'rejected',
    merged: false,
  });
}

async function acceptReconciliationCandidate(client, { candidateId, reviewerUserId }) {
  if (!reviewerUserId) throw new Error('RECONCILIATION_REVIEWER_REQUIRED');
  const candidate = await loadCandidateForReview(client, candidateId);
  if (!candidate) throw new Error('RECONCILIATION_CANDIDATE_NOT_FOUND');
  if (candidate.status !== 'pending') throw new Error('RECONCILIATION_CANDIDATE_ALREADY_REVIEWED');

  const merge = await attachSourceRecordAfterReview(client, {
    sourceRecordId: candidate.source_record_id,
    targetProcessId: candidate.candidate_process_id,
    reviewerUserId,
  });

  return Object.freeze({
    candidateId: candidate.candidate_id,
    sourceRecordId: candidate.source_record_id,
    targetProcessId: candidate.candidate_process_id,
    decision: 'accepted',
    merged: merge.merged,
    previousProcessId: merge.previousProcessId,
  });
}

async function reviewReconciliationCandidate(pool, { candidateId, decision, reviewerUserId }) {
  if (!pool?.connect) throw new Error('DATABASE_POOL_REQUIRED');
  const normalizedDecision = String(decision || '').trim().toLowerCase();
  if (!['accept', 'reject'].includes(normalizedDecision)) {
    throw new Error('RECONCILIATION_DECISION_INVALID');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = normalizedDecision === 'accept'
      ? await acceptReconciliationCandidate(client, { candidateId, reviewerUserId })
      : await rejectReconciliationCandidate(client, { candidateId, reviewerUserId });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  normalizeLimit,
  listPendingReconciliationCandidates,
  loadCandidateForReview,
  rejectReconciliationCandidate,
  acceptReconciliationCandidate,
  reviewReconciliationCandidate,
};
