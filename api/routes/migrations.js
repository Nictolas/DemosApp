'use strict';

// Never perform PostgreSQL DDL through a legacy HTTP endpoint. Explicit,
// reviewed migrations require a maintenance plan and operator approval.
const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(verifyToken, requireAdmin);

router.post('/add-political-opinions-consent-columns', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    code: 'LEGACY_HTTP_GDPR_MIGRATION_RETIRED',
    message: 'Schema changes require an approved offline database migration.'
  });
});

module.exports = router;
