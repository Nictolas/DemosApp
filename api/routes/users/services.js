const express = require('express');

const router = express.Router();

// Tutti i servizi utenti basati su email (reinvia verifica, ecc.) sono stati dismessi.

router.post('/resend-verification-email', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Funzionalità non più disponibile',
    message: 'Il reinvio dell\'email di verifica non è più supportato perché il sistema non usa più le email.'
  });
});

module.exports = router;
