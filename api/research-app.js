const express = require('express');
const shadowConfig = require('./config/privacyResearchShadow');
const {
  mountResearchPublicApiIfProductionReady
} = require('./researchProductionMountGate');
const {
  loadResearchReadinessDeployment
} = require('./config/researchReadinessDeployment');

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

const readinessDeployment = loadResearchReadinessDeployment(process.env);
const researchProductionMount = mountResearchPublicApiIfProductionReady(app, {
  // Technical evidence may be supplied only through the signed deployment manifest.
  // Human production approval remains deliberately separate and is not loaded here.
  decisions: {},
  readinessManifest: readinessDeployment.manifest,
  readinessManifestSignature: readinessDeployment.signature,
  readinessManifestPublicKey: readinessDeployment.publicKey,
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
