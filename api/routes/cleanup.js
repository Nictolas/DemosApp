'use strict';

// Retired destructive test-account deletion endpoints. These bypassed the
// canonical account-erasure transaction and its external GDPR ledger/outbox.
// Mounted only on dev API surfaces; retain route paths to fail closed even
// if an operator enables that surface accidentally.
const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(verifyToken, requireAdmin);

function retiredCleanup(_req, res) {
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    code: 'LEGACY_USER_CLEANUP_RETIRED',
    message: 'Use the canonical authenticated GDPR account-deletion flow.'
  });
}

router.post('/delete-temporary-users', retiredCleanup);
router.post('/delete-test-user', retiredCleanup);

module.exports = router;
