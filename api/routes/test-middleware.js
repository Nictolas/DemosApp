const express = require('express');
const { validateInput, sanitizeInput } = require('../middleware/security');
const { authLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

/**
 * 🧪 TEST MIDDLEWARE VALIDATION
 * POST /api/test/middleware
 */
router.post('/middleware',
  authLimiter,
  sanitizeInput(['email', 'password']),
  validateInput(['email', 'password']),
  async (req, res) => {
    console.log('🎉 MIDDLEWARE TEST SUCCESS!');
    res.json({
      success: true,
      message: 'Tutti i middleware funzionano correttamente',
      receivedData: req.body
    });
  }
);

module.exports = router;
