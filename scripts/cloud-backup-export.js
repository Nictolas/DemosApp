'use strict';

/**
 * RETIRED (GDPR / release safety): legacy direct cloud-copy exporter.
 *
 * The former implementation invoked AWS, GCS, B2 or Azure CLI against
 * operator-selected buckets without independent object-version, integrity,
 * retention or restore attestations. It is not the modern Axiom -> B2 archive
 * service and must never be used as evidence for GH-296 recovery.
 *
 * Historical implementation remains in Git history. Reintroduction requires
 * a separately reviewed and authorised implementation, not an environment
 * flag or an override to this file.
 */
const {
  assertLegacyDataArchivalUnavailable,
  exitRetiredLegacyDataArchival
} = require('../api/services/legacyDataArchivalGate');

if (require.main === module) {
  // Exit before dotenv, credentials, filesystem, database or cloud CLIs.
  exitRetiredLegacyDataArchival();
}

async function backupToS3() { assertLegacyDataArchivalUnavailable(); }
async function backupToGCS() { assertLegacyDataArchivalUnavailable(); }
async function backupToB2() { assertLegacyDataArchivalUnavailable(); }
async function backupToAzure() { assertLegacyDataArchivalUnavailable(); }
async function backupDirectory() { assertLegacyDataArchivalUnavailable(); }
async function backupNewFiles() { assertLegacyDataArchivalUnavailable(); }

module.exports = {
  backupToS3,
  backupToGCS,
  backupToB2,
  backupToAzure,
  backupDirectory,
  backupNewFiles
};
