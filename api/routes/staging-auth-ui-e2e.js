const express = require('express');
const router = express.Router();
const { E2E_USER_ID } = require('../scripts/stagingMigrate');
const { generateAccessToken } = require('../utils/jwt');

router.get('/session', (req, res) => {
  if (process.env.NODE_ENV !== 'staging' || process.env.DEMOS_STAGING_AUTH_UI_E2E !== 'true') {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const expectedKey = process.env.DEMOS_STAGING_AUTH_UI_E2E_KEY || '';
  if (!expectedKey || req.query.key !== expectedKey) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const token = generateAccessToken({ userId: E2E_USER_ID });
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, token, userId: E2E_USER_ID });
});

module.exports = router;
