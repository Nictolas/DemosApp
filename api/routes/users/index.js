const express = require('express');

// Import moduli users
const profileRoutes = require('./profile');
const publicProfileRoutes = require('./public-profile');
const searchRoutes = require('./search');
const adminRoutes = require('./admin');
const servicesRoutes = require('./services');

const router = express.Router();

// Registra i moduli
router.use('/', publicProfileRoutes);
router.use('/', profileRoutes);
router.use('/', searchRoutes);
router.use('/', adminRoutes);
router.use('/', servicesRoutes);

module.exports = router;
