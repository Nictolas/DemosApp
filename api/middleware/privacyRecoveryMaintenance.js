'use strict';

// Opt-in operational protection: enabled ONLY when deployment is in recovery.
// Must be mounted before CORS OPTIONS, health, auth, and all other routes.
function isPrivacyRecoveryMaintenanceActive(env = process.env) {
  // Only an absent value or exactly "false" permits traffic AND background
  // jobs. Any configured typo must block both rather than diverging.
  const mode = env?.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
  return mode !== undefined && mode !== 'false';
}

function privacyRecoveryMaintenance(req, res, next) {
  // Unset or explicitly 'false' is the normal operating mode.
  // Any OTHER configured value is treated as maintenance, including typos
  // like 'TRUE', trailing whitespace and empty strings. Failing open on a
  // misconfigured recovery flag could expose a restored database before
  // privacy replay and independent verification have completed.
  if (!isPrivacyRecoveryMaintenanceActive()) return next();
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.set('Retry-After', '120');
  return res.status(503).json({
    success: false,
    code: 'GDPR_RECOVERY_MAINTENANCE',
    error: 'Servizio temporaneamente non disponibile per manutenzione dei dati'
  });
}

module.exports = { privacyRecoveryMaintenance, isPrivacyRecoveryMaintenanceActive };
