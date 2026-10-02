require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

async function executeUpdate() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Esecuzione script SQL per aggiornare ruoli...\n');
    
    const sqlFile = path.join(__dirname, 'aggiorna-ruolo-politici-non-eletti-fixed.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    // Esegui lo script
    await client.query(sql);
    
    console.log('✅ Script eseguito con successo!\n');
    
    // Verifica i risultati
    const checkResult = await client.query(`
      SELECT nome, cognome, ruolo 
      FROM users 
      WHERE LOWER(TRIM(cognome)) IN (
        LOWER(TRIM('Formigoni')),
        LOWER(TRIM('Bersani')),
        LOWER(TRIM('Di Battista')),
        LOWER(TRIM('Di Maio')),
        LOWER(TRIM('Letta')),
        LOWER(TRIM('Fico'))
      )
      ORDER BY cognome, nome
    `);
    
    console.log('📊 Verifica risultati:');
    console.log('─'.repeat(60));
    checkResult.rows.forEach(row => {
      console.log(`${row.nome} ${row.cognome} - Ruolo: ${row.ruolo}`);
    });
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

executeUpdate().catch(console.error);
