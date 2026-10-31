'use strict';

/**
 * Retired legacy Axiom migration helper.
 * This file used to include unsafe administrative authentication or token
 * generation instructions. Do not re-enable it. All migrations require a
 * separately approved GDPR-safe mechanism and isolated provider tests.
 */
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();
