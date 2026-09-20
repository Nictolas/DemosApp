const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { getIdentityVerificationStatus } = require('../../services/identityVerificationStore');
const { completeCieVerificationFromVerifiedClaims } = require('../../services/cieVerificationService');
const {
  isMockCieEnabled,
  startMockTransaction,
  consumeMockTransaction
} = require('../../services/cieMockFlowService');
const { createAuthorizationRequest } = require('../../services/cieOidcAuthorizationService');
const {
  saveCieOidcTransaction,
  consumeCieOidcTransaction
} = require('../../services/cieOidcTransactionStore');
const { exchangeAuthorizationCode } = require('../../services/cieOidcTokenService');
const { validateCieIdToken } = require('../../services/cieOidcIdTokenService');

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

// Avvia il flusso OIDC CIE reale. E' disabilitato finche CIE_OIDC_ENABLED != true
// e richiede configurazione di federazione + Redis condiviso.
router.get('/identity/cie/start', verifyToken, async (req, res) => {
  try {
    const { authorizationUrl, transaction } = createAuthorizationRequest();
    await saveCieOidcTransaction(req.userId, transaction);

    return res.json({
      success: true,
      authorizationUrl
    });
  } catch (error) {
    const disabled = error?.code === 'CIE_OIDC_DISABLED';
    return res.status(disabled ? 404 : 503).json({
      success: false,
      error: disabled
        ? 'CIE non ancora attiva'
        : 'Configurazione CIE non pronta'
    });
  }
});

// Callback OIDC CIE reale.
// Esegue state/one-time transaction + token exchange private_key_jwt
// e valida firma/issuer/audience/nonce/ACR/at_hash dell'ID Token.
// NON completa ancora l'identita finche non viene validata la UserInfo firmata.
router.get('/cie/callback', async (req, res) => {
  if (process.env.CIE_OIDC_ENABLED !== 'true') {
    return res.status(404).json({
      success: false,
      error: 'CIE non ancora attiva'
    });
  }

  const { code, state, error: providerError } = req.query || {};
  if (typeof state !== 'string' || !state) {
    return res.status(400).json({ success: false, error: 'State CIE mancante' });
  }

  try {
    const transaction = await consumeCieOidcTransaction(state);

    if (providerError) {
      return res.status(400).json({
        success: false,
        error: 'Autenticazione CIE non completata'
      });
    }

    if (typeof code !== 'string' || !code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code CIE mancante'
      });
    }

    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: transaction.codeVerifier
    });

    validateCieIdToken({
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      expectedNonce: transaction.nonce
    });

    // Fail closed: ID Token e nonce sono validati, ma l'identita non viene
    // ancora registrata finche non recuperiamo e validiamo la UserInfo firmata.
    return res.status(503).json({
      success: false,
      error: 'ID Token CIE validato; UserInfo CIE non ancora attiva'
    });
  } catch (error) {
    console.error('Errore callback CIE:', error?.message || error);
    return res.status(400).json({
      success: false,
      error: 'Callback CIE non valida'
    });
  }
});

module.exports = router;
