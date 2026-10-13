'use strict';

const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { getPool } = require('../../config/database');

const router = express.Router();
const pool = getPool();

router.use(verifyToken);
router.use(requireAdmin);

// Lo Staff decide manualmente se l'obiettivo sostanziale di un processo civico
// è stato realizzato da una legge. Lo stato parlamentare non decide questo flag.
router.patch('/:processId/realization', async (req, res) => {
  try {
    const processId = String(req.params.processId || '').trim();
    const realized = req.body?.realized;
    const lawReference = String(req.body?.lawReference || '').trim();
    const reviewerUserId = req.userId || req.user?.id;

    if (!processId || typeof realized !== 'boolean') {
      return res.status(400).json({ success: false, error: 'REALIZATION_INPUT_INVALID' });
    }
    if (realized && !lawReference) {
      return res.status(400).json({ success: false, error: 'LAW_REFERENCE_REQUIRED' });
    }

    const result = await pool.query(
      `UPDATE civic_processes
          SET realized = $2,
              realized_law_reference = CASE WHEN $2 THEN $3 ELSE NULL END,
              realized_verified_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
              realized_verified_by_user_id = CASE WHEN $2 THEN $4::uuid ELSE NULL END,
              updated_at = NOW()
        WHERE id::text = $1
        RETURNING id, jurisdiction_id, process_type_id, canonical_title, realized,
                  realized_law_reference, realized_verified_at, realized_verified_by_user_id`,
      [processId, realized, lawReference || null, reviewerUserId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'CIVIC_PROCESS_NOT_FOUND' });
    }
    return res.json({ success: true, process: result.rows[0] });
  } catch (error) {
    console.error('Errore aggiornamento realizzazione processo civico:', error);
    return res.status(500).json({ success: false, error: 'CIVIC_PROCESS_REALIZATION_UPDATE_FAILED' });
  }
});

module.exports = router;
