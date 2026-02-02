#!/usr/bin/env node
/**
 * Script per popolare la tabella openpolis_ultimi_ddl_approvati su Neon.
 * Esegui dalla cartella api con: node sync-openpolis-ultimi-ddl.js
 * Richiede DATABASE_URL nel .env (o variabile d'ambiente).
 */

require('dotenv').config();
const { getPool } = require('./config/database');
const {
  fetchUltimiDdlApprovati,
  saveToDb,
  parseCosaSuccede,
  findUltimiDdl,
  fetchHomepage,
} = require('./services/openpolisCosaSuccedeService');

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

async function main() {
  console.log('🔄 Sync ultimi DDL approvati da Openpolis...\n');

  let pool;
  try {
    pool = getPool();
  } catch (e) {
    console.error('❌ DATABASE_URL non configurata. Imposta .env o variabile d\'ambiente.');
    process.exit(1);
  }

  try {
    await ensureTable(pool);
    console.log('📥 Fetch homepage Openpolis...');
    const result = await fetchUltimiDdlApprovati();

    if (!result.camera && !result.senato) {
      console.log('⚠️ Nessun DDL approvato trovato nella pagina. Verifica il parsing.');
      const html = await fetchHomepage();
      const events = parseCosaSuccede(html);
      console.log(`   Eventi trovati con link disegni_di_legge: ${events.length}`);
      const { camera, senato } = findUltimiDdl(events);
      if (events.length > 0) {
        console.log('   Primi 3 eventi:', events.slice(0, 3).map(e => ({ titolo: e.titolo?.substring(0, 40), ramo: e.ramo })));
      }
      process.exit(1);
    }

    if (result.camera) {
      console.log('✅ Camera:', result.camera.titolo?.substring(0, 60) + '...');
      console.log('   URL:', result.camera.url_dettaglio);
    }
    if (result.senato) {
      console.log('✅ Senato:', result.senato.titolo?.substring(0, 60) + '...');
      console.log('   URL:', result.senato.url_dettaglio);
    }

    await saveToDb(result, pool);
    console.log('\n✅ Tabella openpolis_ultimi_ddl_approvati aggiornata su Neon.');
    console.log('   Ricarica https://www.demos.community/voti-parlamento per vedere i DDL.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    if (err.response) console.error('   Status:', err.response.status, err.response.statusText);
    process.exit(1);
  } finally {
    if (pool && typeof pool.end === 'function') pool.end();
  }
}

main();
