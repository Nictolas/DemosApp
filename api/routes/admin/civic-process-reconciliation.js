'use strict';

const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { getPool } = require('../../config/database');
const {
  listPendingReconciliationCandidates,
  reviewReconciliationCandidate,
} = require('../../services/civicProcessReconciliationService');

const router = express.Router();
const pool = getPool();

router.use(verifyToken);
router.use(requireAdmin);

function statusForReviewError(error) {
  const message = String(error?.message || '');
  if (message === 'RECONCILIATION_CANDIDATE_NOT_FOUND') return 404;
  if (message === 'RECONCILIATION_CANDIDATE_ALREADY_REVIEWED') return 409;
  if (message === 'RECONCILIATION_DECISION_INVALID' || message === 'RECONCILIATION_CANDIDATE_ID_REQUIRED') return 400;
  return 500;
}

router.get('/pending', async (req, res) => {
  try {
    const candidates = await listPendingReconciliationCandidates(pool, { limit: req.query.limit });
    return res.json({ success: true, candidates, count: candidates.length });
  } catch (error) {
    console.error('Errore elenco riconciliazioni civiche:', error);
    return res.status(500).json({ success: false, error: 'RECONCILIATION_LIST_FAILED' });
  }
});

router.post('/:candidateId/review', async (req, res) => {
  try {
    const result = await reviewReconciliationCandidate(pool, {
      candidateId: req.params.candidateId,
      decision: req.body?.decision,
      reviewerUserId: req.userId,
    });
    return res.json({ success: true, result });
  } catch (error) {
    const status = statusForReviewError(error);
    if (status >= 500) console.error('Errore revisione riconciliazione civica:', error);
    return res.status(status).json({
      success: false,
      error: error?.message || 'RECONCILIATION_REVIEW_FAILED',
    });
  }
});

module.exports = router;
