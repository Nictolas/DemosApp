const express = require('express');
const shadowConfig = require('./config/privacyResearchShadow');
const {
  mountResearchPublicApiIfProductionReady
} = require('./researchProductionMountGate');

// IMPORTANT: this process intentionally does NOT import the normal Demos JWT/auth
// middleware or DATABASE_URL pool. Future Research endpoints authenticate a
// participant cryptographically, not through an account session.
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const researchProductionMount = mountResearchPublicApiIfProductionReady(app, {
  // No production decisions/evidence are injected here yet. This is intentionally
  // fail-closed: the Research process can run health checks while public routes
  // remain unreachable until an approved deployment wires verified evidence.
  decisions: {},
  mountOptions: {}
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'demos-research-shadow',
    mode: shadowConfig.mode,
    enabled: shadowConfig.enabled,
    publicApiMounted: researchProductionMount.mounted
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.locals.researchProductionMount = researchProductionMount;

module.exports = app;
