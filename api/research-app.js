const express = require('express');
const {
  RESEARCH_PUBLIC_MAX_BODY_BYTES
} = require('./config/researchPublicRequestPolicy');
const {
  applyResearchPublicSafetyHeaders,
  sendResearchPublicError
} = require('./services/researchPublicErrorPolicy');
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

const RESEARCH_PUBLIC_HEALTH_BODY = Object.freeze({ success: true });
const RESEARCH_PUBLIC_HEALTH_MAX_BYTES = 32;

if (Buffer.byteLength(JSON.stringify(RESEARCH_PUBLIC_HEALTH_BODY), 'utf8') > RESEARCH_PUBLIC_HEALTH_MAX_BYTES) {
  throw new Error('Research public health response exceeds size bound');
}

app.disable('x-powered-by');
app.disable('etag');

// Privacy headers are applied before parsing so every public response, including
// malformed input and health probes, is non-cacheable and non-indexable.
app.use((req, res, next) => {
  applyResearchPublicSafetyHeaders(res);
  next();
});

app.use(express.json({ limit: RESEARCH_PUBLIC_MAX_BODY_BYTES }));
app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return sendResearchPublicError(res, 413);
  }
  if (error?.type === 'entity.parse.failed') {
    return sendResearchPublicError(res, 400);
  }
  return next(error);
});

const readinessDeployment = loadResearchReadinessDeployment(process.env);
const researchProductionMount = mountResearchPublicApiIfProductionReady(app, {
  // Technical evidence may be supplied only through the signed deployment manifest.
  // Human production approval remains deliberately separate and is not loaded here.
  decisions: {},
  readinessManifest: readinessDeployment.manifest,
  readinessManifestSignature: readinessDeployment.signature,
  readinessManifestPublicKey: readinessDeployment.publicKey,
  expectedCommitSha: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT_SHA,
  mountOptions: {}
});

// Public liveness is intentionally constant: deployment mode, readiness blockers
// and mount state remain available only to local process state, not to the network.
app.get('/health', (req, res) => {
  res.status(200).json(RESEARCH_PUBLIC_HEALTH_BODY);
});

// Unknown paths use the same minimal public error body as other rejected input so
// route discovery does not expose framework or service detail.
app.use('*', (req, res) => {
  sendResearchPublicError(res, 404);
});

app.locals.researchProductionMount = researchProductionMount;

module.exports = app;
