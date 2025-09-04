const express = require('express');

// Import moduli auth
const profileRoutes = require('./profile');
const verificationRoutes = require('./verification');
const loginRoutes = require('./login');
const registrationRoutes = require('./registration');
const passwordResetRoutes = require('./password-reset');
const logoutRoutes = require('./logout');

const router = express.Router();

// Registra i moduli
router.use('/', profileRoutes);
router.use('/', verificationRoutes);
router.use('/', loginRoutes);
router.use('/', registrationRoutes);
router.use('/', passwordResetRoutes);
router.use('/', logoutRoutes);

module.exports = router;
