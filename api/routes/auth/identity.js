const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { getIdentityVerificationStatus } = require('../../services/identityVerificationStore');
const {
  assertAccountCanStartCieVerification,
  completeCieVerificationFromVerifiedClaims
} = require('../../services/cieVerificationService');
const {
  isMockCieEnabled,
  startMockTransaction,
  consumeMockTransaction,
  getMockCieStartErrorResponse,
  getMockCieCompleteErrorResponse
} = require('../../services/cieMockFlowService');
const { createAuthorizationRequest } = require('../../services/cieOidcAuthorizationService');
const {
  saveCieOidcTransaction,
  consumeCieOidcTransaction
} = require('../../services/cieOidcTransactionStore');
const { exchangeAuthorizationCode } = require('../../services/cieOidcTokenService');
const { validateCieIdToken } = require('../../services/cieOidcIdTokenService');
const { fetchAndValidateCieUserInfo } = require('../../services/cieOidcUserInfoService');
const { buildCieCallbackRedirect } = require('../../services/cieCallbackRedirectService');

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
router.post('/identity/cie/mock/start', verifyToken, async (req, res) => {
  if (!isMockCieEnabled()) {
    return res.status(404).json({ success: false, error: 'Route non disponibile' });
  }

  try {
    await assertAccountCanStartCieVerification(req.userId);

    const transaction = startMockTransaction(req.userId);
    return res.json({ success: true, transaction });
  } catch (error) {
    console.error('Errore avvio mock CIE:', error?.message || error);
    const publicError = getMockCieStartErrorResponse(error);
    return res.status(publicError.status).json({
      success: false,
      error: publicError.error
    });
  }
});

router.post('/identity/cie/mock/complete', verifyToken, async (req, res) => {
  if (!isMockCieEnabled()) {
    return res.status(404).json({ success: false, error: 'Route non disponibile' });
  }

  try {
    const { state, nonce, fiscal_number } = req.body || {};
    consumeMockTransaction({ userId: req.userId, state, nonce });

    await completeCieVerificationFromVerifiedClaims({
      userId: req.userId,
      claims: { fiscal_number }
    });

    return res.json({
      success: true,
      verified: true
    });
  } catch (error) {
    console.error('Errore completamento mock CIE:', error?.message || error);
    const publicError = getMockCieCompleteErrorResponse(error);
    return res.status(publicError.status).json({
      success: false,
      error: publicError.error
    });
  }
});

// Avvia il flusso OIDC CIE reale. E' disabilitato finche CIE_OIDC_ENABLED != true
// e richiede configurazione di federazione + Redis condiviso.
router.get('/identity/cie/start', verifyToken, async (req, res) => {
  try {
    await assertAccountCanStartCieVerification(req.userId);

    const { authorizationUrl, transaction } = createAuthorizationRequest();
    await saveCieOidcTransaction(req.userId, transaction);

    return res.json({
      success: true,
      authorizationUrl
    });
  } catch (error) {
    const disabled = error?.code === 'CIE_OIDC_DISABLED';
    const alreadyVerified = error?.code === 'ACCOUNT_ALREADY_VERIFIED';

    if (alreadyVerified) {
      return res.status(409).json({
        success: false,
        error: 'Account gia verificato'
      });
    }

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
// valida ID Token e UserInfo CIE firmata+cifrata, registra l'identita verificata
// e torna al frontend con il solo esito success/error.
router.get('/cie/callback', async (req, res) => {
  if (process.env.CIE_OIDC_ENABLED !== 'true') {
    return res.status(404).json({
      success: false,
      error: 'CIE non ancora attiva'
    });
  }

  const { code, state, error: providerError } = req.query || {};
  if (typeof state !== 'string' || !state) {
    try {
      return res.redirect(303, buildCieCallbackRedirect('error'));
    } catch (redirectError) {
      console.error('Errore redirect callback CIE:', redirectError?.message || redirectError);
      return res.status(500).json({ success: false, error: 'Callback CIE non disponibile' });
    }
  }

  try {
    const transaction = await consumeCieOidcTransaction(state);

    if (providerError) {
      return res.redirect(303, buildCieCallbackRedirect('error'));
    }

    if (typeof code !== 'string' || !code) {
      return res.redirect(303, buildCieCallbackRedirect('error'));
    }

    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: transaction.codeVerifier
    });

    const idTokenClaims = validateCieIdToken({
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      expectedNonce: transaction.nonce
    });

    const userInfo = await fetchAndValidateCieUserInfo({
      accessToken: tokens.accessToken,
      expectedSub: idTokenClaims.sub
    });

    await completeCieVerificationFromVerifiedClaims({
      userId: transaction.userId,
      claims: { fiscal_number: userInfo.fiscalNumber }
    });

    // Non includere mai identity, fiscal_number, person_key, state o sub nell'URL.
    return res.redirect(303, buildCieCallbackRedirect('success'));
  } catch (error) {
    console.error('Errore callback CIE:', error?.message || error);
    try {
      const outcome = error?.code === 'PERSON_ALREADY_LINKED'
        ? 'already-linked'
        : error?.code === 'ACCOUNT_ALREADY_VERIFIED'
          ? 'account-already-verified'
          : 'error';
      return res.redirect(303, buildCieCallbackRedirect(outcome));
    } catch (redirectError) {
      console.error('Errore redirect callback CIE:', redirectError?.message || redirectError);
      return res.status(500).json({ success: false, error: 'Callback CIE non disponibile' });
    }
  }
});

module.exports = router;
