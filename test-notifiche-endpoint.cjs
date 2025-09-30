const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testNotificheEndpoint() {
  try {
    console.log('🔍 Test endpoint notifiche...');
    
    // Test con l'ID di Nicolas (che funziona)
    const nicolasId = '5e51ec52-c656-4f4b-a940-425acb873b0b';
    console.log(`\n📡 Test con Nicolas (${nicolasId}):`);
    
    try {
      // Verifica se l'utente è admin
      const userResult = await pool.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [nicolasId]
      );
      
      console.log(`  - Utente trovato: ${userResult.rows.length > 0}`);
      if (userResult.rows.length > 0) {
        console.log(`  - is_admin: ${userResult.rows[0].is_admin}`);
      }
      
      // Test query comunicazioni
      const comunicazioniResult = await pool.query(`
        SELECT
          c.*,
          $1 = ANY(c.read_by) as is_read
        FROM comunicazioni c
        WHERE c.tipo = 'demos_notification'
        ORDER BY c.data_creazione DESC
        LIMIT 10
      `, [nicolasId]);
      
      console.log(`  - Comunicazioni trovate: ${comunicazioniResult.rows.length}`);
      
    } catch (error) {
      console.log(`  ❌ Errore con Nicolas: ${error.message}`);
    }
    
    // Test con l'ID di Chiara (che non funziona)
    const chiaraId = 'a7bb4b6d-dc3a-4de3-a2d7-ef4130b6d832';
    console.log(`\n📡 Test con Chiara (${chiaraId}):`);
    
    try {
      // Verifica se l'utente è admin
      const userResult = await pool.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [chiaraId]
      );
      
      console.log(`  - Utente trovato: ${userResult.rows.length > 0}`);
      if (userResult.rows.length > 0) {
        console.log(`  - is_admin: ${userResult.rows[0].is_admin}`);
      }
      
      // Test query comunicazioni
      const comunicazioniResult = await pool.query(`
        SELECT
          c.*,
          $1 = ANY(c.read_by) as is_read
        FROM comunicazioni c
        WHERE c.tipo = 'demos_notification'
        ORDER BY c.data_creazione DESC
        LIMIT 10
      `, [chiaraId]);
      
      console.log(`  - Comunicazioni trovate: ${comunicazioniResult.rows.length}`);
      
    } catch (error) {
      console.log(`  ❌ Errore con Chiara: ${error.message}`);
    }
    
    // Controlla se la tabella comunicazioni esiste
    console.log('\n🔍 Controllo tabella comunicazioni...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'comunicazioni'
      );
    `);
    
    console.log(`  - Tabella comunicazioni esiste: ${tableExists.rows[0].exists}`);
    
    if (tableExists.rows[0].exists) {
      const comunicazioniCount = await pool.query('SELECT COUNT(*) FROM comunicazioni');
      console.log(`  - Record in comunicazioni: ${comunicazioniCount.rows[0].count}`);
      
      // Controlla la struttura
      const structure = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' 
        AND column_name IN ('read_by', 'tipo', 'data_creazione')
        ORDER BY column_name
      `);
      
      console.log('  - Colonne rilevanti:');
      structure.rows.forEach(row => {
        console.log(`    - ${row.column_name}: ${row.data_type}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Errore nel test endpoint:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testNotificheEndpoint()
  .then(() => {
    console.log('🎉 Test completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante il test:', error);
    process.exit(1);
  });
