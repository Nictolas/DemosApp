const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUtentiDependencies() {
  try {
    console.log('🔍 Controllo dipendenze tabella utenti...');
    
    // Controlla se la tabella utenti esiste
    const checkUtenti = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'utenti'
      );
    `);
    
    if (!checkUtenti.rows[0].exists) {
      console.log('⚠️ Tabella utenti non trovata');
      return;
    }
    
    // Controlla se la tabella users esiste
    const checkUsers = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    console.log(`📊 Tabella utenti esiste: ${checkUtenti.rows[0].exists}`);
    console.log(`📊 Tabella users esiste: ${checkUsers.rows[0].exists}`);
    
    // Conta i record nella tabella utenti
    const countUtenti = await pool.query('SELECT COUNT(*) FROM utenti');
    console.log(`📊 Record in utenti: ${countUtenti.rows[0].count}`);
    
    if (checkUsers.rows[0].exists) {
      const countUsers = await pool.query('SELECT COUNT(*) FROM users');
      console.log(`📊 Record in users: ${countUsers.rows[0].count}`);
    }
    
    // Controlla le foreign key che dipendono da utenti
    const foreignKeys = await pool.query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'utenti'
        AND tc.table_schema = 'public'
    `);
    
    console.log('\n🔗 Tabelle che dipendono da utenti:');
    if (foreignKeys.rows.length === 0) {
      console.log('  Nessuna dipendenza trovata');
    } else {
      foreignKeys.rows.forEach(row => {
        console.log(`  - ${row.table_name}.${row.column_name} → utenti.${row.foreign_column_name}`);
      });
    }
    
    // Controlla la struttura delle due tabelle
    console.log('\n📋 Struttura tabella utenti:');
    const utentiStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'utenti' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    utentiStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    if (checkUsers.rows[0].exists) {
      console.log('\n📋 Struttura tabella users:');
      const usersStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      usersStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Errore nel controllo dipendenze:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkUtentiDependencies()
  .then(() => {
    console.log('🎉 Controllo completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante il controllo:', error);
    process.exit(1);
  });
