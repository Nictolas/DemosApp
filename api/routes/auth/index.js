const express = require('express');

// Moduli auth attivi: profilo/verifica account, OAuth, passkey, refresh e logout.
const profileRoutes = require('./profile');
const verificationRoutes = require('./verification');
const refreshRoutes = require('./refresh');
const logoutRoutes = require('./logout');
const webauthnRoutes = require('./webauthn');
const oauthConfigRoutes = require('./oauth-config');
const oauthRoutes = require('./oauth');
const identityRoutes = require('./identity');

const router = express.Router();

router.use('/', profileRoutes);
router.use('/', verificationRoutes);
router.use('/', refreshRoutes);
router.use('/', logoutRoutes);
router.use('/', webauthnRoutes);
router.use('/', oauthConfigRoutes);
router.use('/', oauthRoutes);
router.use('/', identityRoutes);

module.exports = router;
