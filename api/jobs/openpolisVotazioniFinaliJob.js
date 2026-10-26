const { isPrivacyRecoveryMaintenanceActive } = require('../middleware/privacyRecoveryMaintenance');
/**
 * Job per aggiornare le votazioni finali decisive da Openpolis.
 * Esegue scraping della lista /votazioni?main_vote_type=is_final, salva in openpolis_votazioni_finali_decisive.
 */

const cron = require('node-cron');
const { getPool } = require('../config/database');
const { fetchVotazioniFinaliDecisive, saveToDb } = require('../services/openpolisVotazioniFinaliService');

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS openpolis_votazioni_finali_decisive (
      id SERIAL PRIMARY KEY,
      openpolis_id VARCHAR(50) NOT NULL UNIQUE,
      camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
      titolo TEXT NOT NULL,
      url_dettaglio TEXT NOT NULL,
      esito VARCHAR(20) NOT NULL CHECK (esito IN ('Approvata', 'Respinta')),
      data_votazione DATE,
      data_scraping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_camera ON openpolis_votazioni_finali_decisive(camera)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_data_votazione ON openpolis_votazioni_finali_decisive(data_votazione DESC NULLS LAST)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_data_scraping ON openpolis_votazioni_finali_decisive(data_scraping DESC)');
}

/**
 * Esegue un singolo ciclo: fetch lista Openpolis voti finali -> salva in DB.
 */
async function runOpenpolisVotazioniFinaliSync() {
  if (isPrivacyRecoveryMaintenanceActive()) return;
  let pool;
  try {
    pool = getPool();
  } catch (e) {
    console.warn('⚠️ [openpolisVotazioniFinali] Pool non disponibile, skip sync:', e.message);
    return;
  }
  try {
    await ensureTable(pool);
    console.log('🔄 [openpolisVotazioniFinali] Avvio sync votazioni finali decisive da Openpolis...');
    const items = await fetchVotazioniFinaliDecisive(50);
    if (items.length > 0) {
      const saved = await saveToDb(items, pool);
      console.log(`✅ [openpolisVotazioniFinali] Salvate ${saved} votazioni finali decisive`);
    } else {
      console.log('⚠️ [openpolisVotazioniFinali] Nessuna votazione finale trovata nella lista');
    }
  } catch (error) {
    console.error('❌ [openpolisVotazioniFinali] Errore sync:', error.message);
  }
}

const openpolisVotazioniFinaliCron = process.env.OPENPOLIS_VOTAZIONI_FINALI_CRON || '45 */6 * * *';
const openpolisVotazioniFinaliJob = cron.schedule(openpolisVotazioniFinaliCron, runOpenpolisVotazioniFinaliSync, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

function startOpenpolisVotazioniFinaliJob() {
  if (isPrivacyRecoveryMaintenanceActive()) return;
  console.log('🚀 Avvio job Openpolis votazioni finali decisive...');
  openpolisVotazioniFinaliJob.start();
  console.log(`✅ Job Openpolis votazioni finali avviato (cron: ${openpolisVotazioniFinaliCron})`);
}

function stopOpenpolisVotazioniFinaliJob() {
  openpolisVotazioniFinaliJob.stop();
  console.log('✅ Job Openpolis votazioni finali fermato');
}

module.exports = {
  runOpenpolisVotazioniFinaliSync,
  startOpenpolisVotazioniFinaliJob,
  stopOpenpolisVotazioniFinaliJob,
  openpolisVotazioniFinaliJob
};
