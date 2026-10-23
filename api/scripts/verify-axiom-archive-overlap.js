'use strict';

// Read-only multi-object recovery check: GET only, no Axiom reads, no B2
// PUT/DELETE, no checkpoint changes, and no personal data in stdout.
const { AxiomArchiveService, recordFingerprint } = require('../services/axiomArchiveService');
const { verifyArchiveOverlap } = require('../services/archiveOverlapVerifier');
const { createReadOnlyOverlapLoader } = require('../services/archiveOverlapB2Reader');

(async () => {
  const [dataset, ...keys] = process.argv.slice(2);
  if (!dataset || keys.length < 2) {
    console.error('Usage: npm run archive:axiom:verify-overlap -- <dataset> <object-key-1> <object-key-2> [...object-keys]');
    process.exitCode = 2;
    return;
  }
  try {
    const archive = new AxiomArchiveService();
    // Config validated, but no authentication or B2 request until keys pass
    // strict prefix/category/dataset and count checks inside the verifier.
    // Input keys must be validated before any network access.
    const result = await verifyArchiveOverlap({
      dataset,
      prefix: archive.prefix,
      keys,
      recordFingerprint,
      load: async key => {
        archive.validateB2Configuration();
        const loadObject = createReadOnlyOverlapLoader({
          client: archive.getB2Client(), bucket: archive.bucket
        });
        return loadObject(key);
      }
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (_error) {
    console.error('ARCHIVE_OVERLAP_VERIFICATION_FAILED');
    process.exitCode = 1;
  }
})();
