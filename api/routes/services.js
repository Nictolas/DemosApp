const express = require('express');

const router = express.Router();

// Endpoint di test per Resend
router.post('/test-resend-email', async (req, res) => {
  try {
    const { testResend } = require('../services/emailService');
    const result = await testResend();
    res.json(result);
  } catch (error) {
    console.error('❌ Errore nel test Resend:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel test Resend',
      message: error.message
    });
  }
});

module.exports = router;
