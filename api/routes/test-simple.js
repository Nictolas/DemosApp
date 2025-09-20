const express = require('express');

const router = express.Router();

/**
 * 🧪 TEST SEMPLICE
 * GET /api/test/simple
 */
router.get('/simple', (req, res) => {
  console.log('🧪 TEST SEMPLICE: Endpoint raggiunto');
  res.json({
    success: true,
    message: 'Test semplice funziona!',
    timestamp: new Date().toISOString()
  });
});

/**
 * 🧪 TEST POST SEMPLICE
 * POST /api/test/simple
 */
router.post('/simple', (req, res) => {
  console.log('🧪 TEST POST SEMPLICE: Endpoint raggiunto');
  console.log('📦 BODY:', req.body);
  res.json({
    success: true,
    message: 'Test POST semplice funziona!',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
