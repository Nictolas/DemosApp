const express = require('express');

// Import moduli opinioni
const managementRoutes = require('./management');
const userAnswersRoutes = require('./user-answers');
const statsRoutes = require('./stats');
// compatibilityRoutes rimosso - gestisce solo politici/candidati

const router = express.Router();

// Registra i moduli
router.use('/', managementRoutes);
router.use('/', userAnswersRoutes);
router.use('/', statsRoutes);

module.exports = router;
