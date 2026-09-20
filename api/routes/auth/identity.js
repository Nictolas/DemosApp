const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { getIdentityVerificationStatus } = require('../../services/identityVerificationStore');

const router = express.Router();

// Stato della verifica identita dell'account autenticato.
// Non espone person_key, codice fiscale o altri identificativi CIE.
router.get('/identity/status', verifyToken, async (req, res) => {
  try {
    const status = await getIdentityVerificationStatus(req.userId);
    return res.json({
      success: true,
      identity: status
    });
  } catch (error) {
    console.error('Errore lettura stato verifica identita:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Impossibile leggere lo stato della verifica identita'
    });
  }
});

// Callback riservato alla futura integrazione OIDC CIE.
// Finche' la verifica crittografica OIDC non e' implementata, non accetta
// ne' salva alcun dato e non deve essere usato in produzione.
router.get('/cie/callback', (_req, res) => {
  return res.status(503).json({
    success: false,
    error: 'Integrazione CIE non ancora attiva'
  });
});

module.exports = router;
