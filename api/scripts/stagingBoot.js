'use strict';
async function runStagingBootGate({ env = process.env, runner } = {}) {
  const mode = env.DEMOS_STAGING_MIGRATION_MODE;
  if (!mode) return { mode: 'disabled' };
  if (env.NODE_ENV !== 'staging') throw new Error('DEMOS_STAGING_MIGRATION_MODE is allowed only with NODE_ENV=staging');
  if (!['baseline','preflight','apply','e2e-seed'].includes(mode)) throw new Error(`Unsupported DEMOS_STAGING_MIGRATION_MODE: ${mode}`);
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required for the staging migration gate');
  const migrationRunner = runner || require('./stagingMigrate').run;
  const runnerEnv = { ...env, STAGING_DATABASE_URL: env.DATABASE_URL };
  const argv = mode === 'baseline' ? ['--baseline'] : mode === 'apply' ? ['--apply'] : mode === 'e2e-seed' ? ['--seed-e2e'] : ['--preflight'];
  if (mode === 'baseline') runnerEnv.ALLOW_DEMOS_STAGING_BASELINE = 'true';
  if (mode === 'apply') runnerEnv.ALLOW_DEMOS_STAGING_MIGRATIONS = 'true';
  if (mode === 'e2e-seed') runnerEnv.ALLOW_DEMOS_STAGING_E2E_SEED = 'true';
  return migrationRunner({ env: runnerEnv, argv });
}
module.exports = { runStagingBootGate };
