const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAdminUser() {
  try {
    console.log('👑 Creando utente Admin di test...');
    
    // Genera un hash della password
    const password = 'admin123'; // Password di test
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Crea l'utente Admin
    const adminUser = {
      id: 'admin-test-' + Date.now(),
      email: 'nicolasmicheletti90@gmail.com',
      nome: 'Nicolas',
      cognome: 'Micheletti',
      password_hash: passwordHash,
      ruolo: 'Admin',
      status: 'approved',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Inserisci l'utente nel database
    const insertQuery = `
      INSERT INTO utenti (
        id, email, nome, cognome, password_hash, ruolo, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, nome, cognome, ruolo, status
    `;
    
    const result = await pool.query(insertQuery, [
      adminUser.id,
      adminUser.email,
      adminUser.nome,
      adminUser.cognome,
      adminUser.password_hash,
      adminUser.ruolo,
      adminUser.status,
      adminUser.created_at,
      adminUser.updated_at
    ]);
    
    const createdUser = result.rows[0];
    
    console.log('✅ Utente Admin creato con successo!');
    console.log('📋 Dettagli utente:');
    console.log(`   - ID: ${createdUser.id}`);
    console.log(`   - Email: ${createdUser.email}`);
    console.log(`   - Nome: ${createdUser.nome} ${createdUser.cognome}`);
    console.log(`   - Ruolo: ${createdUser.ruolo}`);
    console.log(`   - Status: ${createdUser.status}`);
    console.log(`   - Password: ${password} (per test)`);
    
    // Verifica che l'utente sia stato creato
    const verifyQuery = await pool.query('SELECT COUNT(*) FROM utenti');
    console.log(`👥 Numero totale utenti nel database: ${verifyQuery.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Errore durante la creazione dell\'utente Admin:', error);
  } finally {
    await pool.end();
  }
}

createAdminUser();
