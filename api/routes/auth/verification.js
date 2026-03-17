const express = require('express');

const router = express.Router();

// Tutta la logica di verifica email è stata dismessa:
// il sistema non utilizza più l'invio di email né la verifica via link.

router.post('/verify-email', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Funzionalità non più disponibile',
    message: 'La verifica email via link non è più supportata perché il sistema non usa più le email.'
  });
});

router.post('/resend-verification', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Funzionalità non più disponibile',
    message: 'Il reinvio dell\'email di verifica non è più supportato perché il sistema non usa più le email.'
  });
});

module.exports = router;
