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
  saveCieRecognitionTransaction,
  consumeCieOidcTransaction
} = require('../../services/cieOidcTransactionStore');
const { exchangeAuthorizationCode } = require('../../services/cieOidcTokenService');
const { validateCieIdToken } = require('../../services/cieOidcIdTokenService');
const { fetchAndValidateCieUserInfo } = require('../../services/cieOidcUserInfoService');
const {
  buildCieCallbackRedirect,
  buildRecognitionCieCallbackRedirect,
  buildRegistrationCieCallbackRedirect
} = require('../../services/cieCallbackRedirectService');
const { completeOAuthRegistrationAfterCie } = require('../../services/oauthRegistrationService');
const { completePasskeyRegistrationAfterCie } = require('../../services/passkeyRegistrationService');
const { createRegistrationTicket } = require('../../services/registrationTicketStore');
const { getPublicIdentityError } = require('../../services/identityPublicErrorService');
const { IDENTITY_ERROR_CODES } = require('../../constants/identityVerification');
const { assertSameVerifiedPerson, savePublicNameProof } = require('../../services/ciePublicIdentityProofStore');

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
    const publicError = getPublicIdentityError(error, {
      status: 503,
      error: 'Configurazione CIE non pronta'
    });

    return res.status(publicError.status).json({
      success: false,
      ...(publicError.code ? { code: publicError.code } : {}),
      error: publicError.error
    });
  }
});

// Public-role recognition is a separate CIE authentication. It requests
// verified names only for the requesting candidate/elected official, not
// for ordinary citizens or initial account verification.
router.get('/identity/cie/recognition/start', verifyToken, async (req, res) => {
  try {
    const verified = await getIdentityVerificationStatus(req.userId);
    if (verified?.verified !== true || String(verified?.provider || '').toUpperCase() !== 'CIE') {
      return res.status(403).json({ success: false, code: 'CIE_REQUIRED', error: 'Verifica prima la tua identita con CIE.' });
    }
    const { authorizationUrl, transaction } = createAuthorizationRequest(
      Math.floor(Date.now() / 1000), 'recognition'
    );
    await saveCieRecognitionTransaction(req.userId, transaction);
    return res.json({ success: true, authorizationUrl });
  } catch (error) {
    const publicError = getPublicIdentityError(error, {
      status: 503, error: 'Riconoscimento CIE non disponibile'
    });
    return res.status(publicError.status).json({
      success: false,
      ...(publicError.code ? { code: publicError.code } : {}),
      error: publicError.error
    });
  }
});

// Callback OIDC CIE reale.
// Esegue state/one-time transaction + token exchange private_key_jwt,
// valida ID Token e UserInfo. Per una nuova registrazione crea l'account
// solo DOPO la verifica CIE e restituisce al frontend un ticket one-time.
function redirectForCieTransaction(transaction, outcome, ticket = null) {
  if (transaction?.flow === 'registration') {
    return buildRegistrationCieCallbackRedirect(outcome, ticket);
  }
  if (transaction?.flow === 'recognition') {
    return buildRecognitionCieCallbackRedirect(outcome === 'success' ? 'success' : 'error');
  }
  return buildCieCallbackRedirect(outcome);
}

router.get('/cie/callback', async (req, res) => {
  if (process.env.CIE_OIDC_ENABLED !== 'true') {
    const publicError = getPublicIdentityError(
      { code: IDENTITY_ERROR_CODES.CIE_OIDC_DISABLED },
      { status: 404, error: 'CIE non ancora attiva' }
    );

    return res.status(publicError.status).json({
      success: false,
      error: publicError.error
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

  let transaction = null;
  try {
    transaction = await consumeCieOidcTransaction(state);

    if (providerError) {
      return res.redirect(303, redirectForCieTransaction(transaction, 'error'));
    }
    if (typeof code !== 'string' || !code) {
      return res.redirect(303, redirectForCieTransaction(transaction, 'error'));
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
      expectedSub: idTokenClaims.sub,
      requirePublicNames: transaction.flow === 'recognition'
    });

    if (transaction.flow === 'registration') {
      const completeRegistration = transaction.registration?.authMethod === 'passkey'
        ? completePasskeyRegistrationAfterCie
        : completeOAuthRegistrationAfterCie;
      const completed = await completeRegistration({
        registration: transaction.registration,
        fiscalNumber: userInfo.fiscalNumber
      });
      const registrationTicket = await createRegistrationTicket({ userId: completed.userId });

      // Only an opaque, one-time ticket is placed in the URL fragment.
      // Never include fiscal_number, person_key, CIE sub or account identifiers.
      return res.redirect(
        303,
        buildRegistrationCieCallbackRedirect('success', registrationTicket)
      );
    }

    if (transaction.flow === 'recognition') {
      await assertSameVerifiedPerson(transaction.userId, userInfo.fiscalNumber);
      await savePublicNameProof(transaction.userId, userInfo);
      return res.redirect(303, buildRecognitionCieCallbackRedirect('success'));
    }

    await completeCieVerificationFromVerifiedClaims({
      userId: transaction.userId,
      claims: { fiscal_number: userInfo.fiscalNumber }
    });

    return res.redirect(303, buildCieCallbackRedirect('success'));
  } catch (error) {
    console.error('Errore callback CIE:', error?.message || error);
    try {
      const outcome = error?.code === IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED
        ? 'already-linked'
        : error?.code === IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED
          ? 'account-already-verified'
          : 'error';
      return res.redirect(303, redirectForCieTransaction(transaction, outcome));
    } catch (redirectError) {
      console.error('Errore redirect callback CIE:', redirectError?.message || redirectError);
      return res.status(500).json({ success: false, error: 'Callback CIE non disponibile' });
    }
  }
});

module.exports = router;
