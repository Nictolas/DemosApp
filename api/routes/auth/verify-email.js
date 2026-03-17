const express = require('express');

const router = express.Router();

// Questo endpoint è stato deprecato: la verifica email non è più supportata.

router.post('/verify-email', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Funzionalità non più disponibile',
    message: 'La verifica email via link non è più supportata perché il sistema non usa più le email.'
  });
});

module.exports = router;
