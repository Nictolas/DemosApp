require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function executeFixUrls() {
  try {
    console.log('🔧 Correzione URL Openpolis...');
    
    const sqlFile = path.join(__dirname, 'fix-url-openpolis-politici.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    // Esegui lo script SQL
    await pool.query(sql);
    
    console.log('✅ URL corretti con successo!');
    
    // Mostra statistiche
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_politici,
        COUNT(CASE WHEN url_openpolis IS NOT NULL AND url_openpolis != '' AND TRIM(url_openpolis) != '' THEN 1 END) as con_url,
        COUNT(CASE WHEN url_openpolis LIKE '%-%-%-%' THEN 1 END) as url_con_data
      FROM voti_camera
      WHERE politico_nome IN (
        SELECT CONCAT(nome, ' ', cognome) 
        FROM users 
        WHERE ruolo = 'P' 
          AND (grado_elezione = 'C' OR grado_elezione = 'S')
          AND status = 'a'
      )
    `);
    
    console.log('\n📊 Statistiche:');
    console.log(`   Totale politici: ${stats.rows[0].total_politici}`);
    console.log(`   Con URL: ${stats.rows[0].con_url}`);
    console.log(`   URL con data: ${stats.rows[0].url_con_data}`);
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

executeFixUrls();
