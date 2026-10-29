'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { buildDatabaseSsl } = require('../utils/databaseTlsPolicy');

const EXPECTED_DATABASE = 'demos_civic_staging_db';
const E2E_USER_ID = '00000000-0000-4000-8000-000000000001';
const E2E_ACTIVIST_USER_ID = '00000000-0000-4000-8000-000000000002';
const E2E_ADMIN_USER_ID = '00000000-0000-4000-8000-000000000003';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE = 'api/database/staging-base-schema.sql';

const MIGRATIONS = Object.freeze([
  'api/database/create-account-capabilities-model.sql',
  'api/database/create-user-profile-consents.sql',
  'api/database/create-identity-verifications-table.sql',
  '20261009_political_selections.sql',
  '20261009_political_territory_memberships.sql',
  'api/database/create-candidacy-program-model.sql',
  'api/database/create-event-approval-model.sql',
  '20261009_election_lifecycle.sql',
  '20261009_political_opinion_notifications.sql',
  '20261009_preference_cooldowns.sql',
  'api/database/create-comunicazioni-table.sql',
  '20261009_institutional_vote_communications.sql',
  'api/database/create-ministero-table.sql',
  '20261009_civic_processes.sql',
  '20261010_municipal_institutional_communications.sql',
  'api/add-users-opinione-proposta-id.sql',
  'api/database/create-voti-opinioni-proposte-table.sql',
]);

const REQUIRED_BASE_TABLES = Object.freeze(['users', 'eventi', 'programmi']);
const EXPECTED_TABLES = Object.freeze([
  'political_candidacies','political_mandates','political_selections',
  'user_political_territories','user_electoral_unit_memberships',
  'unita_elettorale','unita_elettorale_territorio',
  'political_programs','mandate_program_snapshots','political_opinion_notifications',
  'preference_change_cooldowns','comunicazioni','iniziative_ministero','civic_processes',
  'civic_process_source_records','civic_process_reconciliation_candidates',
  'institutional_territorial_notices','voti_opinioni_proposte','user_profile','user_consents',
  'identity_verifications',
]);

function resolveMigration(relativePath) {
  return path.join(REPO_ROOT, ...relativePath.split('/'));
}
function readSql(relativePath) {
  return fs.readFileSync(resolveMigration(relativePath), 'utf8').replace(/^\uFEFF/, '');
}
function assertMigrationFilesExist() {
  const files = [BASELINE, ...MIGRATIONS];
  const missing = files.filter((file) => !fs.existsSync(resolveMigration(file)));
  if (missing.length) throw new Error(`Missing migration files: ${missing.join(', ')}`);
}
function assertStagingUrl(connectionString) {
  if (!connectionString) throw new Error('STAGING_DATABASE_URL is required');
  let parsed;
  try { parsed = new URL(connectionString); } catch (_) { throw new Error('STAGING_DATABASE_URL is not a valid PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('STAGING_DATABASE_URL must use postgres/postgresql');
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (databaseName !== EXPECTED_DATABASE) throw new Error(`Refusing database ${databaseName || '(empty)'}; expected ${EXPECTED_DATABASE}`);
  return { databaseName };
}
function createClient(connectionString) {
  return new Client({
    connectionString,
    ssl: buildDatabaseSsl(connectionString),
    application_name: 'demos-functional-staging-migrations',
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
    statement_timeout: 15000,
  });
}
async function getBaseTables(client) {
  const result = await client.query(`SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND relname = ANY($1::text[])`, [REQUIRED_BASE_TABLES]);
  return new Set(result.rows.map((row) => row.relname));
}
async function assertBaseSchema(client) {
  const found = await getBaseTables(client);
  const missing = REQUIRED_BASE_TABLES.filter((table) => !found.has(table));
  if (missing.length) throw new Error(`Staging base schema incomplete: ${missing.join(', ')}`);
}
async function applyBaseline(client, logger = console) {
  const found = await getBaseTables(client);
  if (found.size > 0 && found.size < REQUIRED_BASE_TABLES.length) {
    throw new Error(`Refusing partial staging baseline; found: ${[...found].sort().join(', ')}`);
  }
  if (found.size === REQUIRED_BASE_TABLES.length) {
    logger.log('[staging] baseline core already present; reconciling idempotent compatibility tables');
  }
  logger.log(`[staging] applying baseline ${BASELINE}`);
  await client.query(readSql(BASELINE));
  await assertBaseSchema(client);
  logger.log('[staging] baseline OK');
}
async function applyMigrations(client, logger = console) {
  for (const relativePath of MIGRATIONS) {
    logger.log(`[staging] applying ${relativePath}`);
    await client.query(readSql(relativePath));
    logger.log(`[staging] applied ${relativePath}`);
  }
}
async function seedE2EUser(client, logger = console) {
  // Use the live default rather than writing the old PERSON literal.
  // Existing E2E IDs must remain personal accounts in both storage formats.
  const defaults = await client.query(
    "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='account_type'"
  );
  const typeDefault = defaults.rows[0]?.column_default;
  if (!/^'(?:PERSON|P)'::(?:character varying|text)$/.test(typeDefault || '')) {
    throw new Error('Refusing E2E seed: users.account_type default must be PERSON or P');
  }
  const seedIds = [E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID];
  const existing = await client.query(
    'SELECT id, account_type FROM users WHERE id = ANY($1::uuid[])',
    [seedIds]
  );
  if (existing.rows.some(({ account_type }) => !['PERSON', 'P'].includes(account_type))) {
    throw new Error('Refusing E2E seed: synthetic user ID belongs to a non-person account');
  }
  const params = [
    E2E_USER_ID, 'DEMOS E2E Test', 'DEMOS', 'E2E', 'E', 'a', false, false,
    'Italia', 'Toscana', 'Pisa', 'Pisa',
  ];
  await client.query(`
    INSERT INTO users (
      id, name, nome, cognome, ruolo, status, is_admin, is_activist,
      paese_residenza, regione_residenza, provincia_residenza, comune_residenza
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, nome = EXCLUDED.nome, cognome = EXCLUDED.cognome,
      status = 'a', is_admin = FALSE, is_activist = FALSE,
      paese_residenza = EXCLUDED.paese_residenza, regione_residenza = EXCLUDED.regione_residenza,
      provincia_residenza = EXCLUDED.provincia_residenza, comune_residenza = EXCLUDED.comune_residenza
  `, params);
  await client.query(`
    UPDATE users
       SET political_opinions_consent = TRUE,
           political_opinions_consent_timestamp = NOW(),
           updated_at = NOW()
     WHERE id = $1
  `, [E2E_USER_ID]);
  await client.query(`
    INSERT INTO user_consents (
      user_id, privacy_policy_consent, terms_of_service_consent, consent_timestamp,
      political_opinions_consent, political_opinions_consent_timestamp, updated_at
    ) VALUES ($1, TRUE, TRUE, NOW(), TRUE, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      privacy_policy_consent = TRUE,
      terms_of_service_consent = TRUE,
      consent_timestamp = COALESCE(user_consents.consent_timestamp, NOW()),
      political_opinions_consent = TRUE,
      political_opinions_consent_timestamp = NOW(),
      updated_at = NOW()
  `, [E2E_USER_ID]);
  await client.query(`
    INSERT INTO users (id,name,nome,cognome,ruolo,status,is_admin,is_activist,paese_residenza,regione_residenza,provincia_residenza,comune_residenza)
    VALUES ($1,$2,$3,$4,'E','a',FALSE,TRUE,'Italia','Toscana','Pisa','Pisa')
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,nome=EXCLUDED.nome,cognome=EXCLUDED.cognome,status='a',is_admin=FALSE,is_activist=TRUE
  `, [E2E_ACTIVIST_USER_ID,'DEMOS E2E Activist','DEMOS','E2E Activist']);
  await client.query(`
    INSERT INTO users (id,name,nome,cognome,ruolo,status,is_admin,is_activist,paese_residenza,regione_residenza,provincia_residenza,comune_residenza)
    VALUES ($1,$2,$3,$4,'AD','a',TRUE,FALSE,'Italia','Toscana','Pisa','Pisa')
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,nome=EXCLUDED.nome,cognome=EXCLUDED.cognome,status='a',is_admin=TRUE,is_activist=FALSE
  `, [E2E_ADMIN_USER_ID,'DEMOS E2E Admin','DEMOS','E2E Admin']);
  logger.log(`[staging] E2E synthetic users ready: ${E2E_USER_ID}, ${E2E_ACTIVIST_USER_ID}, ${E2E_ADMIN_USER_ID}`);
  return E2E_USER_ID;
}

async function verifyExpectedSchema(client) {
  const result = await client.query(`SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND relname = ANY($1::text[])`, [EXPECTED_TABLES]);
  const found = new Set(result.rows.map((row) => row.relname));
  const missing = EXPECTED_TABLES.filter((table) => !found.has(table));
  if (missing.length) throw new Error(`Post-migration schema incomplete: ${missing.join(', ')}`);
  const columns = await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='users' AND column_name IN ('account_type','is_admin','is_activist','opinione_proposta_id')) OR (table_name='eventi' AND column_name IN ('creator_user_id','approval_status','election_lifecycle_closed_at')) OR (table_name='comunicazioni' AND column_name IN ('institutional_vote_key','institutional_level','vote_date')) OR (table_name='civic_processes' AND column_name IN ('realized','realized_law_reference','realized_verified_at')) OR (table_name='user_profile' AND column_name IN ('user_id','paese_residenza','avatar_config')) OR (table_name='user_consents' AND column_name IN ('user_id','privacy_policy_consent','terms_of_service_consent','political_opinions_consent')) OR (table_name='unita_elettorale' AND column_name IN ('id','evento_id','code','label','unit_type','metadata')) OR (table_name='unita_elettorale_territorio' AND column_name IN ('unita_elettorale_id','territory_type','territory_code','metadata')))`);
  const keys = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const required = ['users.account_type','users.is_admin','users.is_activist','users.opinione_proposta_id','eventi.creator_user_id','eventi.approval_status','eventi.election_lifecycle_closed_at','comunicazioni.institutional_vote_key','comunicazioni.institutional_level','comunicazioni.vote_date','civic_processes.realized','civic_processes.realized_law_reference','civic_processes.realized_verified_at','user_profile.user_id','user_profile.paese_residenza','user_profile.avatar_config','user_consents.user_id','user_consents.privacy_policy_consent','user_consents.terms_of_service_consent','user_consents.political_opinions_consent','unita_elettorale.metadata','unita_elettorale_territorio.territory_type','unita_elettorale_territorio.territory_code'];
  const missingColumns = required.filter((column) => !keys.has(column));
  if (missingColumns.length) throw new Error(`Post-migration columns incomplete: ${missingColumns.join(', ')}`);
}
async function run({ env = process.env, argv = process.argv.slice(2), logger = console } = {}) {
  assertMigrationFilesExist();
  const mode = argv.includes('--baseline') ? 'baseline' : argv.includes('--apply') ? 'apply' : argv.includes('--seed-e2e') ? 'seed-e2e' : argv.includes('--preflight') ? 'preflight' : 'plan';
  if (mode === 'plan') { logger.log(`[staging] target database: ${EXPECTED_DATABASE}`); logger.log(`baseline: ${BASELINE}`); MIGRATIONS.forEach((file,index)=>logger.log(`${index+1}. ${file}`)); return {mode,migrationCount:MIGRATIONS.length}; }
  if (mode === 'baseline' && env.ALLOW_DEMOS_STAGING_BASELINE !== 'true') throw new Error('ALLOW_DEMOS_STAGING_BASELINE=true is required for --baseline');
  if (mode === 'apply' && env.ALLOW_DEMOS_STAGING_MIGRATIONS !== 'true') throw new Error('ALLOW_DEMOS_STAGING_MIGRATIONS=true is required for --apply');
  if (mode === 'seed-e2e' && env.ALLOW_DEMOS_STAGING_E2E_SEED !== 'true') throw new Error('ALLOW_DEMOS_STAGING_E2E_SEED=true is required for --seed-e2e');
  const connectionString = env.STAGING_DATABASE_URL;
  const { databaseName } = assertStagingUrl(connectionString);
  const client = createClient(connectionString);
  await client.connect();
  try {
    const identity = await client.query('SELECT current_database() AS database_name');
    if (identity.rows[0]?.database_name !== EXPECTED_DATABASE) throw new Error(`Connected to unexpected database ${identity.rows[0]?.database_name || '(unknown)'}`);
    if (mode === 'baseline') await applyBaseline(client, logger);
    await assertBaseSchema(client);
    logger.log(`[staging] preflight OK: ${databaseName}`);
    if (mode === 'apply') { await applyMigrations(client, logger); await verifyExpectedSchema(client); logger.log(`[staging] migration + schema verification OK: ${databaseName}`); }
    if (mode === 'seed-e2e') { await verifyExpectedSchema(client); await seedE2EUser(client, logger); }
    return { mode, databaseName, migrationCount: MIGRATIONS.length, ...(mode === 'seed-e2e' ? { e2eUserId: E2E_USER_ID } : {}) };
  } finally { await client.end(); }
}
if (require.main === module) run().catch((error)=>{ console.error(`[staging] FAILED: ${error.message}`); process.exitCode=1; });
module.exports = { EXPECTED_DATABASE, E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID, BASELINE, MIGRATIONS, REQUIRED_BASE_TABLES, EXPECTED_TABLES, assertMigrationFilesExist, assertStagingUrl, createClient, seedE2EUser, run };
