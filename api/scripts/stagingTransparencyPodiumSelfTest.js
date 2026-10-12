'use strict';

const { getPool } = require('../config/database');
const { E2E_USER_ID } = require('./stagingMigrate');

const PODIUM_SUBJECT_ID = '00000000-0000-4000-8000-000000000030';
const LEVELS = Object.freeze([
  { level: 'EUROPEO', field: 'rappresentante_europeo', office: 'eu.parliament.it', alias: 'E', jurisdiction: { country: 'Italia', level: 'E' } },
  { level: 'CAMERA', field: 'rappresentante_camera', office: 'it.camera', alias: 'C', jurisdiction: { country: 'Italia', level: 'C' } },
  { level: 'SENATO', field: 'rappresentante_senato', office: 'it.senato', alias: 'S', jurisdiction: { country: 'Italia', level: 'S' } },
  { level: 'REGIONE', field: 'rappresentante_regionale', office: 'it.regional', alias: 'R', jurisdiction: { country: 'Italia', region: 'Toscana', level: 'R' } },
  { level: 'COMUNE', field: 'rappresentante_comune', office: 'it.municipal', alias: 'CO', jurisdiction: { country: 'Italia', region: 'Toscana', municipality: 'Pisa', level: 'CO' } },
]);

async function expectJson(response, expectedStatus, label) {
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (response.status !== expectedStatus) {
    throw new Error(`${label}: expected ${expectedStatus}, got ${response.status}${body ? ` ${JSON.stringify(body)}` : ''}`);
  }
  return body;
}

async function cleanup(pool) {
  await pool.query('DELETE FROM political_selections WHERE user_id = $1 OR selected_user_id = $2', [E2E_USER_ID, PODIUM_SUBJECT_ID]);
  await pool.query('DELETE FROM comunicazioni WHERE id_utente = $1', [PODIUM_SUBJECT_ID]);
  await pool.query('DELETE FROM political_mandates WHERE user_id = $1', [PODIUM_SUBJECT_ID]);
  await pool.query(`UPDATE users SET
    rappresentante_europeo = NULL,
    rappresentante_camera = NULL,
    rappresentante_senato = NULL,
    rappresentante_regionale = NULL,
    rappresentante_comune = NULL
    WHERE id = $1`, [E2E_USER_ID]);
  await pool.query('DELETE FROM users WHERE id = $1', [PODIUM_SUBJECT_ID]);
}

async function seedFixture(pool) {
  await cleanup(pool);
  await pool.query(`
    INSERT INTO users (
      id, name, nome, cognome, ruolo, status, account_type, is_admin, is_activist,
      paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
      paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_elezione
    ) VALUES ($1,$2,$3,$4,'P','a','PERSON',FALSE,FALSE,'Italia','Toscana','Pisa','Pisa','Italia','Toscana','Pisa','Pisa','E')
  `, [PODIUM_SUBJECT_ID, 'DEMOS E2E Podium', 'DEMOS', 'Podium']);

  for (const item of LEVELS) {
    await pool.query(`
      INSERT INTO political_mandates (user_id, office_code, institution_code, jurisdiction, status, starts_at, source)
      VALUES ($1,$2,$3,$4::jsonb,'ACTIVE',NOW() - INTERVAL '30 days','E2E_F12_30')
    `, [PODIUM_SUBJECT_ID, item.office, `E2E_${item.level}`, JSON.stringify(item.jurisdiction)]);

    await pool.query(`
      INSERT INTO comunicazioni (
        id_utente, titolo, testo, tipo, institutional_level, vote_date,
        source_vote_id, institutional_vote_key, data_creazione
      ) VALUES ($1,$2,$3,'votazione',$4,CURRENT_DATE,$5,$6,NOW())
    `, [
      PODIUM_SUBJECT_ID,
      `E2E F12-30 ${item.level}`,
      'Synthetic Transparency Podium qualification vote',
      item.level,
      `e2e-f12-30-${item.level.toLowerCase()}`,
      `e2e-f12-30-${item.level.toLowerCase()}`,
    ]);
  }
}

async function runStagingTransparencyPodiumSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  pool = getPool(),
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_TRANSPARENCY_PODIUM_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 7 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_TRANSPARENCY_PODIUM_E2E is allowed only with NODE_ENV=staging');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging Transparency Podium E2E');
  if (!pool || typeof pool.query !== 'function') throw new Error('database pool is required for staging Transparency Podium E2E');

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const token = makeToken({ userId: E2E_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  let passed = 0;

  try {
    await seedFixture(pool);

    const podiumResponse = await fetchImpl(`${baseUrl}/api/podio-trasparenza`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const podium = await expectJson(podiumResponse, 200, 'Transparency Podium read');
    if (podium?.window_days !== 90) throw new Error(`unexpected Podium window: ${podium?.window_days}`);
    for (const item of LEVELS) {
      const rows = podium?.levels?.[item.level];
      if (!Array.isArray(rows) || !rows.some((row) => String(row.id_utente) === PODIUM_SUBJECT_ID)) {
        throw new Error(`synthetic Podium subject missing from ${item.level}`);
      }
    }
    logger.log('[staging-podium-e2e] synthetic subject appears in all five rankings PASS');
    passed += 1;

    for (const item of LEVELS) {
      const response = await fetchImpl(`${baseUrl}/api/users/${E2E_USER_ID}/seleziona-rappresentante`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ campo: item.field, rappresentanteId: PODIUM_SUBJECT_ID, source: 'podio' }),
        signal: AbortSignal.timeout(8000),
      });
      await expectJson(response, 200, `Podium direct selection ${item.level}`);

      const canonical = await pool.query(`
        SELECT selected_user_id, source
          FROM political_selections
         WHERE user_id = $1 AND kind = 'representative' AND office_id = $2
      `, [E2E_USER_ID, item.office]);
      if (String(canonical.rows[0]?.selected_user_id || '') !== PODIUM_SUBJECT_ID || canonical.rows[0]?.source !== 'podio') {
        throw new Error(`canonical Podium selection missing for ${item.level}`);
      }
      logger.log(`[staging-podium-e2e] ${item.level} direct selection + canonical persistence PASS`);
      passed += 1;
    }

    await cleanup(pool);
    const leftovers = await pool.query(`
      SELECT
        EXISTS (SELECT 1 FROM users WHERE id = $1) AS subject_exists,
        EXISTS (SELECT 1 FROM political_mandates WHERE user_id = $1) AS mandate_exists,
        EXISTS (SELECT 1 FROM comunicazioni WHERE id_utente = $1) AS communication_exists,
        EXISTS (SELECT 1 FROM political_selections WHERE user_id = $2 OR selected_user_id = $1) AS selection_exists
    `, [PODIUM_SUBJECT_ID, E2E_USER_ID]);
    const row = leftovers.rows[0] || {};
    if (row.subject_exists || row.mandate_exists || row.communication_exists || row.selection_exists) {
      throw new Error(`final synthetic Podium cleanup failed: ${JSON.stringify(row)}`);
    }
    logger.log('[staging-podium-e2e] final cleanup verification PASS');
    passed += 1;

    logger.log(`[staging-podium-e2e] PASS ${passed}/7`);
    return { mode: 'transparency-podium-e2e', passed, total: 7 };
  } finally {
    try {
      await cleanup(pool);
      logger.log('[staging-podium-e2e] cleanup PASS');
    } catch (cleanupError) {
      logger.error(`[staging-podium-e2e] cleanup FAILED: ${cleanupError.message}`);
      throw cleanupError;
    }
  }
}

module.exports = {
  PODIUM_SUBJECT_ID,
  LEVELS,
  cleanup,
  seedFixture,
  runStagingTransparencyPodiumSelfTest,
};
