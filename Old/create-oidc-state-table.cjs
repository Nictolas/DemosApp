// Script per creare la tabella oidc_states nel database
// Necessaria per gestire il flusso OIDC su istanze multiple (es. Render)

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createOIDCStateTable() {
  try {
    console.log('🔧 Creazione tabella oidc_states...');

    // Crea tabella
    await pool.query(`
      CREATE TABLE IF NOT EXISTS oidc_states (
        state VARCHAR(255) PRIMARY KEY,
        code_verifier TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crea indice per pulizia automatica degli state scaduti
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_oidc_states_expires_at 
      ON oidc_states(expires_at)
    `);

    console.log('✅ Tabella oidc_states creata con successo!');
    console.log('📊 Indice creato per ottimizzazione query');

    // Pulisci eventuali state scaduti
    const cleanupResult = await pool.query(`
      DELETE FROM oidc_states WHERE expires_at < NOW()
    `);
    console.log(`🧹 Puliti ${cleanupResult.rowCount} state scaduti`);

  } catch (error) {
    console.error('❌ Errore nella creazione tabella oidc_states:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createOIDCStateTable();

