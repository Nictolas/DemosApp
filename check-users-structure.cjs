const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUsersStructure() {
  try {
    console.log('🔍 Controllo struttura tabella users...');
    
    // Controlla la struttura della tabella users
    const usersStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Struttura tabella users:');
    usersStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Controlla se is_admin esiste
    const hasIsAdmin = usersStructure.rows.some(row => row.column_name === 'is_admin');
    console.log(`\n🔍 Colonna is_admin esiste: ${hasIsAdmin}`);
    
    // Controlla se is_premium esiste
    const hasIsPremium = usersStructure.rows.some(row => row.column_name === 'is_premium');
    console.log(`🔍 Colonna is_premium esiste: ${hasIsPremium}`);
    
    // Controlla se premium esiste (potrebbe essere il nome corretto)
    const hasPremium = usersStructure.rows.some(row => row.column_name === 'premium');
    console.log(`🔍 Colonna premium esiste: ${hasPremium}`);
    
    // Controlla se ruolo esiste
    const hasRuolo = usersStructure.rows.some(row => row.column_name === 'ruolo');
    console.log(`🔍 Colonna ruolo esiste: ${hasRuolo}`);
    
    // Controlla alcuni record per vedere i valori
    console.log('\n📊 Esempi di record:');
    const sampleUsers = await pool.query('SELECT id, email, nome, cognome FROM users LIMIT 3');
    sampleUsers.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} - ${user.nome} ${user.cognome}`);
    });
    
  } catch (error) {
    console.error('❌ Errore nel controllo struttura:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkUsersStructure()
  .then(() => {
    console.log('🎉 Controllo completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante il controllo:', error);
    process.exit(1);
  });
