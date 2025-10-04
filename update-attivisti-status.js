const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function updateAttivistiStatus() {
  try {
    console.log('🔄 Aggiornamento status attivisti da "approved" a "active"...');
    
    // Aggiorna tutti gli utenti con ruolo "Attivista" da "approved" a "active"
    const result = await pool.query(`
      UPDATE users 
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE ruolo = 'Attivista' AND status = 'approved'
    `);
    
    console.log(`✅ Aggiornati ${result.rowCount} attivisti con status "active"`);
    
    // Verifica il risultato
    const verifyResult = await pool.query(`
      SELECT id, nome, cognome, email, ruolo, status 
      FROM users 
      WHERE ruolo = 'Attivista'
      ORDER BY created_at DESC
    `);
    
    console.log('📋 Lista attivisti aggiornata:');
    verifyResult.rows.forEach(attivista => {
      console.log(`- ${attivista.nome} ${attivista.cognome} (${attivista.email}) - Status: ${attivista.status}`);
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento:', error);
  } finally {
    await pool.end();
  }
}

updateAttivistiStatus();
