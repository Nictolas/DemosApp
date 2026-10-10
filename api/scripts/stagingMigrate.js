'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const EXPECTED_DATABASE = 'demos_civic_staging_db';
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const MIGRATIONS = Object.freeze([
  'api/database/create-account-capabilities-model.sql',
  '20261009_political_selections.sql',
  '20261009_political_territory_memberships.sql',
  'api/database/create-candidacy-program-model.sql',
  'api/database/create-event-approval-model.sql',
  '20261009_election_lifecycle.sql',
  '20261009_political_opinion_notifications.sql',
  '20261009_preference_cooldowns.sql',
  '20261009_institutional_vote_communications.sql',
  '20261009_civic_processes.sql',
  '20261010_municipal_institutional_communications.sql',
  'api/database/create-voti-opinioni-proposte-table.sql',
]);

const REQUIRED_BASE_TABLES = Object.freeze(['users', 'eventi', 'comunicazioni']);
const EXPECTED_TABLES = Object.freeze([
  'political_candidacies',
  'political_mandates',
  'political_selections',
  'user_political_territories',
  'user_electoral_unit_memberships',
  'political_programs',
  'mandate_program_snapshots',
  'political_opinion_notifications',
  'preference_change_cooldowns',
  'civic_processes',
  'civic_process_source_records',
  'civic_process_reconciliation_candidates',
  'institutional_territorial_notices',
  'voti_opinioni_proposte',
]);

function resolveMigration(relativePath) {
  return path.join(REPO_ROOT, ...relativePath.split('/'));
}

function assertMigrationFilesExist() {
  const missing = MIGRATIONS.filter((file) => !fs.existsSync(resolveMigration(file)));
  if (missing.length) {
    throw new Error(`Missing migration files: ${missing.join(', ')}`);
  }
}

function assertStagingUrl(connectionString) {
  if (!connectionString) throw new Error('STAGING_DATABASE_URL is required');
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch (_error) {
    throw new Error('STAGING_DATABASE_URL is not a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('STAGING_DATABASE_URL must use postgres/postgresql');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (databaseName !== EXPECTED_DATABASE) {
    throw new Error(`Refusing database ${databaseName || '(empty)'}; expected ${EXPECTED_DATABASE}`);
  }
  return { databaseName };
}

function createClient(connectionString) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: 'demos-functional-staging-migrations',
  });
}

async function assertBaseSchema(client) {
  const result = await client.query(
    `SELECT relname
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relkind IN ('r','p')
        AND relname = ANY($1::text[])`,
    [REQUIRED_BASE_TABLES],
  );
  const found = new Set(result.rows.map((row) => row.relname));
  const missing = REQUIRED_BASE_TABLES.filter((table) => !found.has(table));
  if (missing.length) throw new Error(`Staging base schema incomplete: ${missing.join(', ')}`);
}

async function applyMigrations(client, logger = console) {
  for (const relativePath of MIGRATIONS) {
    const absolutePath = resolveMigration(relativePath);
    const sql = fs.readFileSync(absolutePath, 'utf8');
    logger.log(`[staging] applying ${relativePath}`);
    await client.query(sql);
    logger.log(`[staging] applied ${relativePath}`);
  }
}

async function verifyExpectedSchema(client) {
  const result = await client.query(
    `SELECT relname
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relkind IN ('r','p')
        AND relname = ANY($1::text[])`,
    [EXPECTED_TABLES],
  );
  const found = new Set(result.rows.map((row) => row.relname));
  const missing = EXPECTED_TABLES.filter((table) => !found.has(table));
  if (missing.length) throw new Error(`Post-migration schema incomplete: ${missing.join(', ')}`);

  const columns = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'users' AND column_name IN ('account_type','is_admin','is_activist')) OR
          (table_name = 'eventi' AND column_name IN ('creator_user_id','approval_status','election_lifecycle_closed_at')) OR
          (table_name = 'comunicazioni' AND column_name IN ('institutional_vote_key','institutional_level','vote_date')) OR
          (table_name = 'civic_processes' AND column_name IN ('realized','realized_law_reference','realized_verified_at'))
        )`,
  );
  const keys = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const required = [
    'users.account_type', 'users.is_admin', 'users.is_activist',
    'eventi.creator_user_id', 'eventi.approval_status', 'eventi.election_lifecycle_closed_at',
    'comunicazioni.institutional_vote_key', 'comunicazioni.institutional_level', 'comunicazioni.vote_date',
    'civic_processes.realized', 'civic_processes.realized_law_reference', 'civic_processes.realized_verified_at',
  ];
  const missingColumns = required.filter((column) => !keys.has(column));
  if (missingColumns.length) {
    throw new Error(`Post-migration columns incomplete: ${missingColumns.join(', ')}`);
  }
}

async function run({ env = process.env, argv = process.argv.slice(2), logger = console } = {}) {
  assertMigrationFilesExist();
  const mode = argv.includes('--apply') ? 'apply' : argv.includes('--preflight') ? 'preflight' : 'plan';

  if (mode === 'plan') {
    logger.log(`[staging] target database: ${EXPECTED_DATABASE}`);
    MIGRATIONS.forEach((file, index) => logger.log(`${index + 1}. ${file}`));
    return { mode, migrationCount: MIGRATIONS.length };
  }

  if (mode === 'apply' && env.ALLOW_DEMOS_STAGING_MIGRATIONS !== 'true') {
    throw new Error('ALLOW_DEMOS_STAGING_MIGRATIONS=true is required for --apply');
  }

  const connectionString = env.STAGING_DATABASE_URL;
  const { databaseName } = assertStagingUrl(connectionString);
  const client = createClient(connectionString);
  await client.connect();
  try {
    const identity = await client.query('SELECT current_database() AS database_name');
    if (identity.rows[0]?.database_name !== EXPECTED_DATABASE) {
      throw new Error(`Connected to unexpected database ${identity.rows[0]?.database_name || '(unknown)'}`);
    }
    await assertBaseSchema(client);
    logger.log(`[staging] preflight OK: ${databaseName}`);

    if (mode === 'apply') {
      await applyMigrations(client, logger);
      await verifyExpectedSchema(client);
      logger.log(`[staging] migration + schema verification OK: ${databaseName}`);
    }
    return { mode, databaseName, migrationCount: MIGRATIONS.length };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(`[staging] FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_DATABASE,
  MIGRATIONS,
  REQUIRED_BASE_TABLES,
  EXPECTED_TABLES,
  assertMigrationFilesExist,
  assertStagingUrl,
  run,
};
