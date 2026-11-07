'use strict';

const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const {
  isDiagnosticRouteEnabled,
  observeAppCheckHeader,
} = require('../../services/firebaseAppCheckObservation');

const router = express.Router();

/**
 * Admin-only, opt-in manual App Check diagnostic.
 * Only X-Firebase-AppCheck is examined; tokens must never be sent as query,
 * body, log event, or telemetry. Does not affect authentication or voting.
 */
router.post('/observe', verifyToken, requireAdmin, async (req, res) => {
  // Defence in depth: app.js only mounts this router behind the same gate.
  if (!isDiagnosticRouteEnabled()) {
    return res.status(404).end();
  }

  const result = await observeAppCheckHeader(req.headers);
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  return res.status(200).json({ status: result.status });
});

module.exports = router;
