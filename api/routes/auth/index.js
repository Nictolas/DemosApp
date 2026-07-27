const express = require('express');

// Import moduli auth
const profileRoutes = require('./profile');
const verificationRoutes = require('./verification');
const loginRoutes = require('./login');
const registrationRoutes = require('./registration');
const passwordResetRoutes = require('./password-reset');
const changePasswordRoutes = require('./change-password');
const logoutRoutes = require('./logout');
const verifyEmailRoutes = require('./verify-email');
const resendVerificationRoutes = require('./resend-verification');
const webauthnRoutes = require('./webauthn');
const oauthRoutes = require('./oauth');

const router = express.Router();

// Registra i moduli
router.use('/', profileRoutes);
router.use('/', verificationRoutes);
router.use('/', loginRoutes);
router.use('/', registrationRoutes);
router.use('/', passwordResetRoutes);
router.use('/', changePasswordRoutes);
router.use('/', logoutRoutes);
router.use('/', verifyEmailRoutes);
router.use('/', resendVerificationRoutes);
router.use('/', webauthnRoutes);
router.use('/', oauthRoutes);

module.exports = router;
