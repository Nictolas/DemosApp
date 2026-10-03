const express = require('express');
const { createSecurityCenterHandlers } = require('./securityCenterApi');

function createSecurityCenterRouter({ service, verifyToken, requireAdmin } = {}) {
  if (typeof verifyToken !== 'function' || typeof requireAdmin !== 'function') {
    throw new TypeError('verifyToken and requireAdmin middleware are required');
  }

  const router = express.Router();
  const handlers = createSecurityCenterHandlers(service);

  // Read-only by design. No POST/PATCH/PUT/DELETE routes belong in this router.
  router.get('/overview', verifyToken, requireAdmin, handlers.overview);
  router.get('/incidents', verifyToken, requireAdmin, handlers.incidents);
  router.get('/health', verifyToken, requireAdmin, handlers.health);
  router.get('/notifications', verifyToken, requireAdmin, handlers.notifications);

  return router;
}

module.exports = { createSecurityCenterRouter };
