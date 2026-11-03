'use strict';

/**
 * RETIRED: historical hybrid-cloud backup / cleanup.
 *
 * The old implementation loaded database credentials and constructed a Pool
 * even when imported. It also used unverified cloud CLI uploads, and its
 * obsolete cleanup path was not an independently attested GDPR recovery flow.
 *
 * Do not restore this implementation with an environment flag. Archives
 * remain untouched. Modern Axiom -> B2 archiving is independent.
 */
const {
  assertLegacyDataArchivalUnavailable,
  exitRetiredLegacyDataArchival
} = require('../api/services/legacyDataArchivalGate');

if (require.main === module) {
  // Block every CLI command before reading secrets, importing a provider,
  // connecting to PostgreSQL, accessing files, or spawning cloud commands.
  exitRetiredLegacyDataArchival();
}

async function dailyBackup() { assertLegacyDataArchivalUnavailable(); }
async function checkExportNeeded() { assertLegacyDataArchivalUnavailable(); }
async function getCloudStorageSize() { assertLegacyDataArchivalUnavailable(); }
async function cleanupCloudAfterExport() { assertLegacyDataArchivalUnavailable(); }

module.exports = {
  dailyBackup,
  checkExportNeeded,
  getCloudStorageSize,
  cleanupCloudAfterExport
};
