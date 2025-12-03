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

// Rotte Mock CIE (solo in development o se USE_MOCK_CIE=true)
const isMockEnabled = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_CIE === 'true';
if (isMockEnabled) {
  router.use('/mock-cie', mockCieRoutes);
  console.log('🧪 Mock CIE server abilitato');
}

module.exports = router;
