'use strict';
const express = require('express');
const { verifyToken, pool } = require('../../middleware/auth');
const { requireDpo } = require('../../middleware/dpoAccess');
const router = express.Router();
router.use(verifyToken, requireDpo);
router.get('/overview', async (_req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::integer AS total FROM public.user_rights_requests');
    return res.json({success:true,data:{role:'DPO',access:'privacy_oversight_readonly',gdpr_requests_total:result.rows?.[0]?.total ?? 0,retention_policy:'pending_approval',log_policy:'pending_legal_scope_review'}});
  } catch (_) {
    return res.status(503).json({ success:false, error:'Riepilogo privacy non disponibile' });
  }
});
module.exports = router;
