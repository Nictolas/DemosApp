const express = require('express');

const router = express.Router();

/**
 * Public OAuth client configuration.
 * OAuth client IDs are public identifiers, not secrets. Exposing them at runtime
 * keeps native/Capacitor builds from depending on Vite build-time variables.
 */
router.get('/oauth/config', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    appleClientId: process.env.APPLE_CLIENT_ID || null,
  });
});

module.exports = router;
