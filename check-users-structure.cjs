require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function checkUsersStructure() {
  try {
    console.log('🔍 DEBUG: CONTROLLO STRUTTURA TABELLA USERS');
    
    // Controlla la struttura della tabella
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 STRUTTURA COLONNE:');
    columns.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Controlla alcuni utenti esistenti
    const users = await pool.query(`
      SELECT id, name, email, created_at 
      FROM users 
      LIMIT 5
    `);
    
    console.log('\n📊 PRIMI 5 UTENTI:');
    users.rows.forEach(user => {
      console.log(`ID: ${user.id} (tipo: ${typeof user.id})`);
      console.log(`  Nome: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Creato: ${user.created_at}`);
      console.log('---');
    });
    
    // Controlla se ci sono utenti con opinioni
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    console.log(`\n📊 Utenti con opinioni: ${usersWithOpinions.rows[0].count}`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
  }
}

checkUsersStructure();
