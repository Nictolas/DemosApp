'use strict';

/**
 * Retired legacy administrator diagnostics.
 * The historical implementation embedded a password and performed live
 * authentication. No credential-bearing diagnostic should be executable.
 * Rebuild with explicit identity verification, no hardcoded secrets, and
 * a reviewed read-only API if it is ever needed again.
 */
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();
