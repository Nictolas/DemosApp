require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function removeUnusedColumns() {
  try {
    console.log('🗑️ Rimozione colonne non più necessarie dalla tabella users...');
    
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // Colonne da rimuovere
    const columnsToRemove = [
      'image',           // Immagine
      'email_verified',  // Email Verificata
      'data_registrazione', // Data Registrazione
      'updated_at',      // Ultimo Aggiornamento
      'reset_token',     // Reset_token
      'reset_token_expiry', // Reset_token_expiry
      'uid',            // UID
      'fcm_tokens'      // FCM Tokens
    ];
    
    // Verifica colonne esistenti
    const existingColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    console.log('📊 Colonne esistenti nella tabella users:', existingColumnNames);
    
    // Filtra solo le colonne che esistono realmente
    const columnsToRemoveFiltered = columnsToRemove.filter(col => existingColumnNames.includes(col));
    
    if (columnsToRemoveFiltered.length === 0) {
      console.log('ℹ️ Nessuna colonna da rimuovere trovata');
      await client.release();
      await pool.end();
      return;
    }
    
    console.log('🗑️ Colonne da rimuovere:', columnsToRemoveFiltered);
    
    // Rimuovi le colonne una per una
    for (const column of columnsToRemoveFiltered) {
      try {
        console.log(`🗑️ Rimuovo colonna: ${column}`);
        await client.query(`ALTER TABLE users DROP COLUMN IF EXISTS ${column}`);
        console.log(`✅ Colonna ${column} rimossa con successo`);
      } catch (error) {
        console.error(`❌ Errore nella rimozione della colonna ${column}:`, error.message);
      }
    }
    
    // Verifica colonne rimanenti
    const remainingColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Colonne rimanenti nella tabella users:');
    remainingColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });
    
    await client.release();
    await pool.end();
    
    console.log('\n✅ Rimozione colonne completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la rimozione delle colonne:', error);
    await pool.end();
  }
}

removeUnusedColumns();
