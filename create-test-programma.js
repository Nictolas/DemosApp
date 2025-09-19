const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTestProgramma() {
  try {
    console.log('🔍 Creazione programma di test per utente c4c4e79c-6b4f-49f4-b3b8-4bc555b275d7...');
    
    // Inserisci un programma di test
    const result = await pool.query(`
      INSERT INTO programmi (
        utente_id, 
        proposta_1, proposta_2, proposta_3, proposta_4, proposta_5,
        url_1, url_2, url_3, url_4, url_5,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (utente_id)
      DO UPDATE SET
        proposta_1 = EXCLUDED.proposta_1,
        proposta_2 = EXCLUDED.proposta_2,
        proposta_3 = EXCLUDED.proposta_3,
        proposta_4 = EXCLUDED.proposta_4,
        proposta_5 = EXCLUDED.proposta_5,
        url_1 = EXCLUDED.url_1,
        url_2 = EXCLUDED.url_2,
        url_3 = EXCLUDED.url_3,
        url_4 = EXCLUDED.url_4,
        url_5 = EXCLUDED.url_5,
        updated_at = NOW()
      RETURNING *
    `, [
      'c4c4e79c-6b4f-49f4-b3b8-4bc555b275d7',
      'Riduzione delle tasse per le piccole e medie imprese per favorire la crescita economica',
      'Investimenti massicci nelle energie rinnovabili per combattere il cambiamento climatico',
      'Riforma del sistema sanitario con maggiore attenzione alla prevenzione',
      'Potenziamento dell\'istruzione pubblica con più risorse per scuole e università',
      'Lotta alla corruzione con pene più severe e controlli più stringenti',
      'https://esempio.com/proposta-1',
      'https://esempio.com/proposta-2',
      'https://esempio.com/proposta-3',
      'https://esempio.com/proposta-4',
      'https://esempio.com/proposta-5'
    ]);
    
    console.log('✅ Programma creato/aggiornato con successo!');
    console.log('📋 Dati inseriti:', JSON.stringify(result.rows[0], null, 2));
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

createTestProgramma();
