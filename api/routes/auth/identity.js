const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { getIdentityVerificationStatus } = require('../../services/identityVerificationStore');
const { completeCieVerificationFromVerifiedClaims } = require('../../services/cieVerificationService');
const {
  isMockCieEnabled,
  startMockTransaction,
  consumeMockTransaction
} = require('../../services/cieMockFlowService');

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


// Flusso CIE mock: disponibile solo fuori produzione e con USE_MOCK_CIE=true.
router.post('/identity/cie/mock/start', verifyToken, (req, res) => {
  if (!isMockCieEnabled()) {
    return res.status(404).json({ success: false, error: 'Route non disponibile' });
  }

  try {
    const transaction = startMockTransaction(req.userId);
    return res.json({ success: true, transaction });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/identity/cie/mock/complete', verifyToken, async (req, res) => {
  if (!isMockCieEnabled()) {
    return res.status(404).json({ success: false, error: 'Route non disponibile' });
  }

  try {
    const { state, nonce, fiscal_number } = req.body || {};
    consumeMockTransaction({ userId: req.userId, state, nonce });

    const identity = await completeCieVerificationFromVerifiedClaims({
      userId: req.userId,
      claims: { fiscal_number }
    });

    return res.json({ success: true, identity });
  } catch (error) {
    const status = error?.code === 'PERSON_ALREADY_LINKED' ? 409 : 400;
    return res.status(status).json({
      success: false,
      error: error?.message || 'Verifica CIE mock non riuscita'
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
