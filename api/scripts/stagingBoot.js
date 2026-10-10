'use strict';

async function runStagingBootGate({ env = process.env, runner } = {}) {
  const mode = env.DEMOS_STAGING_MIGRATION_MODE;
  if (!mode) return { mode: 'disabled' };

  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_MIGRATION_MODE is allowed only with NODE_ENV=staging');
  }
  if (!['preflight', 'apply'].includes(mode)) {
    throw new Error(`Unsupported DEMOS_STAGING_MIGRATION_MODE: ${mode}`);
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the staging migration gate');
  }

  const migrationRunner = runner || require('./stagingMigrate').run;
  const runnerEnv = {
    ...env,
    STAGING_DATABASE_URL: env.DATABASE_URL,
  };
  const argv = mode === 'apply' ? ['--apply'] : ['--preflight'];
  if (mode === 'apply') {
    runnerEnv.ALLOW_DEMOS_STAGING_MIGRATIONS = 'true';
  }

  return migrationRunner({ env: runnerEnv, argv });
}

module.exports = { runStagingBootGate };
