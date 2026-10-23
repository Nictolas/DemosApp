'use strict';
const express = require('express');
const { verifyToken, pool } = require('../../middleware/auth');
const { requirePrivacyOverviewAccess } = require('../../middleware/dpoAccess');
const router = express.Router();
router.use(verifyToken, requirePrivacyOverviewAccess);
router.get('/overview', async (req, res) => {
  try {
    // Non confondere il seed di migrazione con richieste esercitate dagli utenti.
    // Soli conteggi aggregati: nessun payload GDPR o identificatore individuale.
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed')::integer AS operational_total,
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed' AND status = 'pending')::integer AS pending,
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed' AND status = 'processing')::integer AS processing,
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed' AND status = 'completed')::integer AS completed,
        COUNT(*) FILTER (WHERE request_data->>'source' = 'migration_seed')::integer AS baseline_excluded
      FROM public.user_rights_requests
    `);
    const counts = result.rows?.[0] || {};
    return res.json({
      success: true,
      data: {
        role: req.privacyOverviewRole,
        access: 'privacy_oversight_readonly',
        gdpr_requests_total: counts.operational_total ?? 0,
        gdpr_requests_pending: counts.pending ?? 0,
        gdpr_requests_processing: counts.processing ?? 0,
        gdpr_requests_completed: counts.completed ?? 0,
        gdpr_requests_migration_excluded: counts.baseline_excluded ?? 0,
        rights_counter_scope: 'user_rights_requests_excluding_migration_seed',
        retention_policy: 'pending_approval',
        log_policy: 'pending_legal_scope_review'
      }
    });
  } catch (_) {
    return res.status(503).json({ success:false, error:'Riepilogo privacy non disponibile' });
  }
});
module.exports = router;
