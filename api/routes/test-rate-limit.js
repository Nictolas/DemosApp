const express = require('express');
const router = express.Router();

// Endpoint di test per verificare il rate limiting
router.get('/test-rate-limit', (req, res) => {
  res.json({
    success: true,
    message: 'Rate limiting test endpoint',
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
});

// Endpoint per verificare lo stato del rate limiting
router.get('/rate-limit-status', (req, res) => {
  res.json({
    success: true,
    message: 'Rate limiting status',
    timestamp: new Date().toISOString(),
    ip: req.ip,
    headers: {
      'x-ratelimit-limit': req.get('x-ratelimit-limit'),
      'x-ratelimit-remaining': req.get('x-ratelimit-remaining'),
      'x-ratelimit-reset': req.get('x-ratelimit-reset')
    }
  });
});

module.exports = router;
