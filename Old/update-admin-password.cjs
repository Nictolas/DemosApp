const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateAdminPassword() {
  try {
    console.log('🔐 Aggiornando password utente Admin...');
    
    // Genera una nuova password hash
    const newPassword = 'admin123'; // Password di test
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Aggiorna la password dell'utente Admin
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE email = 'nicolasmicheletti90@gmail.com' AND ruolo = 'Admin'
      RETURNING id, email, nome, cognome, ruolo
    `;
    
    const result = await pool.query(updateQuery, [passwordHash]);
    
    if (result.rows.length === 0) {
      console.log('❌ Utente Admin non trovato o aggiornamento fallito');
      return;
    }
    
    const updatedUser = result.rows[0];
    
    console.log('✅ Password utente Admin aggiornata con successo!');
    console.log('📋 Dettagli utente:');
    console.log(`   - ID: ${updatedUser.id}`);
    console.log(`   - Email: ${updatedUser.email}`);
    console.log(`   - Nome: ${updatedUser.nome} ${updatedUser.cognome}`);
    console.log(`   - Ruolo: ${updatedUser.ruolo}`);
    console.log(`   - Nuova Password: ${newPassword} (per test)`);
    
    // Verifica che l'aggiornamento sia stato effettuato
    const verifyQuery = await pool.query(`
      SELECT id, email, ruolo, password_hash IS NOT NULL as has_password 
      FROM users 
      WHERE email = 'nicolasmicheletti90@gmail.com'
    `);
    
    if (verifyQuery.rows.length > 0) {
      const user = verifyQuery.rows[0];
      console.log(`🔍 Verifica: Utente ${user.email} ha password: ${user.has_password ? 'SÌ' : 'NO'}`);
    }
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiornamento password:', error);
  } finally {
    await pool.end();
  }
}

updateAdminPassword();
