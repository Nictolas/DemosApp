'use strict';

const { getIdentityVerificationStatus } = require('../services/identityVerificationStore');
const { IDENTITY_PROVIDERS } = require('../constants/identityVerification');
const { isCieRequiredForCivicActions } = require('../services/civicIdentityPolicy');

async function requireVerifiedCivicIdentity(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ success: false, error: 'Autenticazione richiesta', code: 'AUTH_REQUIRED' });
  }

  // Fase iniziale: un account autenticato può compiere le azioni civiche senza
  // verifica CIE. Questa eccezione NON dichiara verificata l'identità.
  // La configurazione viene letta dal server ad ogni richiesta e valori
  // sconosciuti causano il rifiuto (mai una disattivazione accidentale).
  let cieRequired;
  try {
    cieRequired = isCieRequiredForCivicActions();
  } catch (_) {
    return res.status(503).json({
      success: false,
      error: 'Configurazione della verifica identita non disponibile',
      code: 'CIVIC_IDENTITY_POLICY_INVALID',
    });
  }
  if (!cieRequired) {
    req.civicIdentity = Object.freeze({
      verified: false,
      provider: null,
      requirementDeferred: true,
    });
    return next();
  }

  // Eccezione amministratore temporanea: serve finché il rollout CIE non è
  // operativo per l'account di amministrazione. Resta fail-closed per tutti
  // gli altri utenti e non modifica lo stato di verifica persistente.
  if (req.user?.isAdmin === true) {
    req.civicIdentity = Object.freeze({
      verified: true,
      provider: 'ADMIN_TEMPORARY_EXCEPTION',
      temporaryAdminException: true,
    });
    return next();
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