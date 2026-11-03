'use strict';

/**
 * Legacy application-level JSON backup API retired.
 *
 * The format was incomplete and must never be treated as an authoritative
 * database recovery mechanism. Keep authentication/authorization checks,
 * then reject every legacy path without touching filesystem, PostgreSQL,
 * background backup jobs, or external providers.
 *
 * Provider-backed recovery is tracked separately under GDPR release gates;
 * this router must not be repurposed to enable it without independent review.
 */
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

router.use(verifyToken);
router.use(requireAdmin);
router.use((_req, res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  return res.status(410).json({
    success: false,
    error: 'LEGACY_APP_BACKUP_RETIRED'
  });
});

module.exports = router;
