'use strict';

// Opt-in operational protection: enabled ONLY when deployment is in recovery.
// Must be mounted before CORS OPTIONS, health, auth, and all other routes.
function privacyRecoveryMaintenance(req, res, next) {
  if (process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE !== 'true') return next();
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.set('Retry-After', '120');
  return res.status(503).json({
    success: false,
    code: 'GDPR_RECOVERY_MAINTENANCE',
    error: 'Servizio temporaneamente non disponibile per manutenzione dei dati'
  });
}

module.exports = { privacyRecoveryMaintenance };
