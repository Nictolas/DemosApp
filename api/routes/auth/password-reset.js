const express = require('express');

const router = express.Router();

// I flussi di reset password via email sono stati dismessi.

router.post('/forgot-password', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Funzionalità non più disponibile',
    message: 'Il reset password via email non è più supportato perché il sistema non usa più le email.'
  });
});

router.post('/reset-password', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Funzionalità non più disponibile',
    message: 'Il reset password tramite link ricevuto via email non è più supportato.'
  });
});

module.exports = router;
