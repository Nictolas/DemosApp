'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { getPool } = require('../config/database');
const { isCivicPushEnabled } = require('../services/civicPushTopics');
const { dispatchCivicNewInitiatives } = require('../services/civicNewInitiativePushDispatcher');

const router = express.Router();

function hasValidDispatchKey(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || expected.length < 32) {
    return false;
  }
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Private server-to-server endpoint. No JWT or user FCM tokens are exposed.
// The secret is required in addition to explicit delivery opt-in (default OFF).
router.post('/dispatch', async (req, res) => {
  if (!isCivicPushEnabled()) return res.status(503).json({ success: false, error: 'CIVIC_PUSH_DISABLED' });

  const expected = process.env.CIVIC_PUSH_DISPATCH_KEY;
  if (!hasValidDispatchKey(req.headers['x-civic-dispatch-key'], expected)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const summary = await dispatchCivicNewInitiatives(getPool());
    if (summary.blocked) {
      return res.status(423).json({ success: false, error: 'CIVIC_DELIVERY_BLOCKED' });
    }
    if (summary.failed > 0) {
      return res.status(503).json({ success: false, error: 'CIVIC_DELIVERY_UNCERTAIN' });
    }
    return res.json({ success: true, ...summary });
  } catch {
    // Never reflect database errors or Firebase configuration into the response.
    res.status(503).json({ success: false, error: 'CIVIC_DISPATCH_UNAVAILABLE' });
  }
});

module.exports = router;
module.exports.hasValidDispatchKey = hasValidDispatchKey;
