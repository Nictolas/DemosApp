const express = require('express');

// Import moduli auth
const profileRoutes = require('./profile');
const verificationRoutes = require('./verification');
const loginRoutes = require('./login');
const registrationRoutes = require('./registration');
const passwordResetRoutes = require('./password-reset');
const logoutRoutes = require('./logout');
const verifyEmailRoutes = require('./verify-email');
const resendVerificationRoutes = require('./resend-verification');
const cieRoutes = require('./cie');
const mockCieRoutes = require('./mock-cie');

const router = express.Router();

// Registra i moduli
router.use('/', profileRoutes);
router.use('/', verificationRoutes);
router.use('/', loginRoutes);
router.use('/', registrationRoutes);
router.use('/', passwordResetRoutes);
router.use('/', logoutRoutes);
router.use('/', verifyEmailRoutes);
router.use('/', resendVerificationRoutes);

// Rotte CIE (autenticazione reale)
router.use('/cie', cieRoutes);

// Rotte Mock CIE (sempre disponibile se le variabili OIDC non sono configurate)
// In development o se USE_MOCK_CIE=true, è sempre abilitato
// In produzione, è abilitato se le variabili OIDC non sono configurate (fallback)
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_CIE === 'true';
const hasOIDCConfig = !!(process.env.CIE_ISSUER_URL || process.env.OIDC_ISSUER_URL);
const isMockEnabled = isDevelopment || !hasOIDCConfig;

if (isMockEnabled) {
  router.use('/mock-cie', mockCieRoutes);
  if (isDevelopment) {
    console.log('🧪 Mock CIE server abilitato (development mode)');
  } else {
    console.log('🧪 Mock CIE server abilitato (fallback - variabili OIDC non configurate)');
  }
}

module.exports = router;
