'use strict';

const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const router = express.Router();

// This legacy endpoint cannot currently persist or list a user's GDPR cases.
// Return an honest failure instead of falsely acknowledging a DSAR. Until a
// durable, access-controlled case register is wired in, use the verified DPO
// contact channel. Do not echo the submitted request or log its contents.
function unavailable(_req, res, action) {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  return res.status(503).json({
    success: false,
    error: 'GDPR_REQUESTS_NOT_AVAILABLE',
    message: action === 'submit'
      ? 'La richiesta non è stata registrata. Contatta privacy@demos.community per esercitare i tuoi diritti.'
      : 'Lo storico delle richieste non è disponibile qui. Per assistenza contatta privacy@demos.community.',
  });
}

router.get('/', verifyToken, (req, res) => unavailable(req, res, 'list'));
router.post('/', verifyToken, (req, res) => unavailable(req, res, 'submit'));

module.exports = router;
