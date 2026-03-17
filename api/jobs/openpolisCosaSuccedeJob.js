/**
 * Job per aggiornare gli ultimi DDL approvati (Camera e Senato) da Openpolis "Cosa succede".
 * Esegue scraping della homepage e delle pagine dettaglio, salva in openpolis_ultimi_ddl_approvati.
 */

const cron = require('node-cron');
const { getPool } = require('../config/database');
const { fetchUltimiDdlApprovati, saveToDb } = require('../services/openpolisCosaSuccedeService');

/**
 * Assicura che la tabella openpolis_ultimi_ddl_approvati esista.
 */
async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS openpolis_ultimi_ddl_approvati (
      camera VARCHAR(50) NOT NULL PRIMARY KEY CHECK (camera IN ('Camera', 'Senato')),
      titolo TEXT NOT NULL,
      codice_ddl VARCHAR(50) NOT NULL,
      url_dettaglio TEXT NOT NULL,
      data_approvazione DATE,
      data_scraping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_ultimi_ddl_camera ON openpolis_ultimi_ddl_approvati(camera)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_ultimi_ddl_data_scraping ON openpolis_ultimi_ddl_approvati(data_scraping DESC)');
}

/**
 * Esegue un singolo ciclo: fetch Openpolis -> salva in DB.
 */
async function runOpenpolisCosaSuccedeSync() {
  let pool;
  try {
    pool = getPool();
  } catch (e) {
    console.warn('⚠️ [openpolisCosaSuccede] Pool non disponibile, skip sync:', e.message);
    return;
  }
  try {
    await ensureTable(pool);
    console.log('🔄 [openpolisCosaSuccede] Avvio sync ultimi DDL approvati da Openpolis...');
    const result = await fetchUltimiDdlApprovati();
    if (result.camera || result.senato) {
      await saveToDb(result, pool);
      if (result.camera) console.log(`   ✅ Camera: ${result.camera.titolo?.substring(0, 50)}...`);
      if (result.senato) console.log(`   ✅ Senato: ${result.senato.titolo?.substring(0, 50)}...`);
      console.log('✅ [openpolisCosaSuccede] Sync completata');
    } else {
      console.log('⚠️ [openpolisCosaSuccede] Nessun DDL approvato trovato nella pagina');
    }
  } catch (error) {
    console.error('❌ [openpolisCosaSuccede] Errore sync:', error.message);
  }
}

/**
 * Cron: ogni 6 ore (in fase con voti parlamento)
 */
const openpolisCosaSuccedeJob = cron.schedule('30 */6 * * *', runOpenpolisCosaSuccedeSync, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

function startOpenpolisCosaSuccedeJob() {
  console.log('🚀 Avvio job Openpolis Cosa succede (ultimi DDL approvati)...');
  openpolisCosaSuccedeJob.start();
  console.log('✅ Job Openpolis Cosa succede avviato (ogni 6 ore)');
}

function stopOpenpolisCosaSuccedeJob() {
  openpolisCosaSuccedeJob.stop();
  console.log('✅ Job Openpolis Cosa succede fermato');
}

module.exports = {
  runOpenpolisCosaSuccedeSync,
  startOpenpolisCosaSuccedeJob,
  stopOpenpolisCosaSuccedeJob,
  openpolisCosaSuccedeJob
};
