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
const {
  buildCieCallbackRedirect,
  buildRegistrationCieCallbackRedirect
} = require('../../services/cieCallbackRedirectService');
const { completeOAuthRegistrationAfterCie } = require('../../services/oauthRegistrationService');
const { completePasskeyRegistrationAfterCie } = require('../../services/passkeyRegistrationService');
const { createRegistrationTicket } = require('../../services/registrationTicketStore');
const { getPublicIdentityError } = require('../../services/identityPublicErrorService');
const { IDENTITY_ERROR_CODES } = require('../../constants/identityVerification');

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
    console.error('IDENTITY_STATUS_FAILED');
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
    console.error('CIE_MOCK_START_FAILED');
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
    console.error('CIE_MOCK_COMPLETE_FAILED');
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

// Callback OIDC CIE reale.
// Esegue state/one-time transaction + token exchange private_key_jwt,
// valida ID Token e UserInfo. Per una nuova registrazione crea l'account
// solo DOPO la verifica CIE e restituisce al frontend un ticket one-time.
function redirectForCieTransaction(transaction, outcome, ticket = null) {
  if (transaction?.flow === 'registration') {
    return buildRegistrationCieCallbackRedirect(outcome, ticket);
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
      console.error('CIE_CALLBACK_REDIRECT_FAILED');
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
      expectedSub: idTokenClaims.sub
    });

    if (transaction.flow === 'registration') {
      const completeRegistration = transaction.registration?.authMethod === 'passkey'
        ? completePasskeyRegistrationAfterCie
        : completeOAuthRegistrationAfterCie;
      const completed = await completeRegistration({
        registration: transaction.registration,
        fiscalNumber: userInfo.fiscalNumber,
        verifiedCieSex: userInfo.sesso ?? null
      });
      const registrationTicket = await createRegistrationTicket({ userId: completed.userId });

      // Only an opaque, one-time ticket is placed in the URL fragment.
      // Never include fiscal_number, person_key, CIE sub or account identifiers.
      return res.redirect(
        303,
        buildRegistrationCieCallbackRedirect('success', registrationTicket)
      );
    }

    await completeCieVerificationFromVerifiedClaims({
      userId: transaction.userId,
      claims: { fiscal_number: userInfo.fiscalNumber, sesso: userInfo.sesso ?? null }
    });

    return res.redirect(303, buildCieCallbackRedirect('success'));
  } catch (error) {
    console.error('CIE_CALLBACK_FAILED');
    try {
      const outcome = error?.code === IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED
        ? 'already-linked'
        : error?.code === IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED
          ? 'account-already-verified'
          : 'error';
      return res.redirect(303, redirectForCieTransaction(transaction, outcome));
    } catch (redirectError) {
      console.error('CIE_CALLBACK_REDIRECT_FAILED');
      return res.status(500).json({ success: false, error: 'Callback CIE non disponibile' });
    }
  }
});

module.exports = router;
