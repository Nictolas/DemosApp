const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTestUser() {
  try {
    console.log('🔍 Verifica utenti nel database...');
    
    // Verifica tutti gli utenti
    const query = 'SELECT id, nome, cognome, email FROM users LIMIT 5';
    const result = await pool.query(query);
    
    console.log(`📋 Trovati ${result.rows.length} utenti:`);
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Nome: ${user.nome} ${user.cognome}, Email: ${user.email}`);
    });
    
    // Verifica se esiste un utente con email test@example.com
    const testQuery = 'SELECT id, nome, cognome, email FROM users WHERE email = $1';
    const testResult = await pool.query(testQuery, ['test@example.com']);
    
    if (testResult.rows.length > 0) {
      console.log('\n✅ Utente test@example.com trovato:', testResult.rows[0]);
    } else {
      console.log('\n❌ Utente test@example.com non trovato');
      
      // Crea un utente di test
      console.log('\n🔧 Creazione utente di test...');
      const insertQuery = `
        INSERT INTO users (nome, cognome, email, password_hash, ruolo, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, nome, cognome, email
      `;
      
      const testPassword = 'test123';
      const bcrypt = require('bcryptjs');
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(testPassword, saltRounds);
      
      const insertResult = await pool.query(insertQuery, [
        'Test', 'User', 'test@example.com', passwordHash, 'Elettore'
      ]);
      
      console.log('✅ Utente di test creato:', insertResult.rows[0]);
      console.log('🔑 Password di test:', testPassword);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkTestUser();
