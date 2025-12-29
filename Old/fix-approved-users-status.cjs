const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixApprovedUsersStatus() {
  try {
    console.log('🔍 Correzione status utenti da "approved" a "active"...');
    
    // Conta utenti con status approved
    const approvedCount = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE status = 'approved'
    `);
    
    console.log(`📊 Utenti con status "approved": ${approvedCount.rows[0].count}`);
    
    if (approvedCount.rows[0].count > 0) {
      // Lista utenti che verranno aggiornati
      const approvedUsers = await pool.query(`
        SELECT id, email, nome, cognome, status, created_at
        FROM users 
        WHERE status = 'approved'
        ORDER BY created_at DESC
      `);
      
      console.log('\n👥 Utenti che verranno aggiornati:');
      approvedUsers.rows.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} - ${user.nome} ${user.cognome} (${user.status})`);
      });
      
      // Aggiorna status da approved a active
      const updateResult = await pool.query(`
        UPDATE users 
        SET status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'approved'
      `);
      
      console.log(`\n✅ ${updateResult.rowCount} utenti aggiornati da "approved" a "active"`);
      
      // Verifica aggiornamento
      const verifyCount = await pool.query(`
        SELECT COUNT(*) as count FROM users WHERE status = 'active'
      `);
      
      console.log(`📊 Totale utenti con status "active": ${verifyCount.rows[0].count}`);
      
      // Controlla se Chiara è stata aggiornata
      const chiaraCheck = await pool.query(`
        SELECT id, email, nome, cognome, status 
        FROM users 
        WHERE email = 'chiara.nardone0@gmail.com'
      `);
      
      if (chiaraCheck.rows.length > 0) {
        const chiara = chiaraCheck.rows[0];
        console.log(`\n✅ Chiara aggiornata: ${chiara.email} - Status: ${chiara.status}`);
      }
      
    } else {
      console.log('ℹ️ Nessun utente con status "approved" trovato');
    }
    
    // Mostra distribuzione status
    const statusDistribution = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM users 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Distribuzione status utenti:');
    statusDistribution.rows.forEach(row => {
      console.log(`  - ${row.status}: ${row.count} utenti`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante la correzione status:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixApprovedUsersStatus()
  .then(() => {
    console.log('🎉 Correzione status completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante la correzione:', error);
    process.exit(1);
  });
