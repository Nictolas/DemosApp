'use strict';

const { getIdentityVerificationStatus } = require('../services/identityVerificationStore');
const { IDENTITY_PROVIDERS } = require('../constants/identityVerification');

async function requireVerifiedCivicIdentity(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ success: false, error: 'Autenticazione richiesta', code: 'AUTH_REQUIRED' });
  }

  try {
    const identity = await getIdentityVerificationStatus(req.userId);
    if (!identity.verified || identity.provider !== IDENTITY_PROVIDERS.CIE) {
      return res.status(403).json({
        success: false,
        error: 'Verifica CIE richiesta',
        message: 'Questa azione civica richiede una identita verificata tramite CIE.',
        code: 'CIVIC_IDENTITY_CIE_REQUIRED',
        identity_verification_required: true,
        required_provider: IDENTITY_PROVIDERS.CIE,
      });
    }
    req.civicIdentity = identity;
    return next();
  } catch (error) {
    console.error('Errore verifica identita civica:', error?.message || error);
    return res.status(503).json({
      success: false,
      error: 'Verifica identita temporaneamente non disponibile',
      code: 'CIVIC_IDENTITY_CHECK_UNAVAILABLE',
    });
  }
}

module.exports = { requireVerifiedCivicIdentity };