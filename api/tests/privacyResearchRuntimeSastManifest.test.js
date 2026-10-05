const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('node:path');
const manifest = require('../config/researchRuntimeSastManifest');
const repoRoot = path.join(__dirname, '..', '..');

test('Research runtime SAST manifest contains the current standalone runtime closure', () => {
  assert.deepEqual(manifest, [
    'api/research-server.js',
    'api/research-app.js',
    'api/config/privacyResearchShadow.js',
    'api/config/researchDatabase.js',
    'api/researchProductionMountGate.js',
    'api/config/researchProductionReadinessPolicy.js',
    'api/researchPublicApiMount.js',
    'api/config/researchPublicExposurePolicy.js',
    'api/config/researchPublicRequestPolicy.js',
    'api/middleware/researchPublicBoundary.js',
    'api/routes/researchPublicRouter.js',
    'api/handlers/researchPublicHandlers.js',
    'api/services/researchPublicApiContract.js',
    'api/services/researchProofChallengeStore.js',
    'api/services/researchOpinionVectorReader.js',
    'api/services/researchOpinionVectorProofVerifierFactory.js',
    'api/services/researchOpinionVectorService.js',
    'api/services/researchEd25519SignatureVerifier.js',
    'api/services/researchParticipantProofVerifier.js',
    'api/services/researchParticipantProofPolicy.js',
    'api/config/researchReadinessManifest.js',
    'api/config/researchReadinessDeployment.js',
    'api/services/researchPoliticalVectorReader.js',
    'api/services/researchPoliticalVectorAdapter.js',
    'api/services/researchAggregateReader.js',
    'api/services/researchAggregatePublicResponsePolicy.js',
    'api/services/researchAggregatePublicationPolicy.js',
    'api/services/researchAggregateMethodology.js'
  ]);
  manifest.forEach((file) => assert.equal(fs.existsSync(path.join(repoRoot, file)), true));
});

test('Research runtime manifest covers every direct local import of its entries', () => {
  const manifestSet = new Set(manifest);
  for (const relativeFile of manifest) {
    const source = fs.readFileSync(path.join(repoRoot, relativeFile), 'utf8');
    const dir = path.posix.dirname(relativeFile);
    const dependencies = [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)]
      .map((match) => match[1])
      .filter((request) => request.startsWith('.'))
      .map((request) => {
        let resolved = path.posix.normalize(path.posix.join(dir, request));
        if (!path.posix.extname(resolved)) resolved += '.js';
        return resolved;
      });
    dependencies.forEach((dependency) => assert.equal(manifestSet.has(dependency), true));
  }
});
