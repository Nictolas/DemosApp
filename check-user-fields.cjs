const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUserFields() {
  try {
    console.log('🔍 Controllo struttura tabella users...\n');
    
    // Query per ottenere la struttura della tabella users
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    console.log('📋 Struttura tabella users:');
    structureResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable} - Default: ${row.column_default || 'N/A'}`);
    });
    
    // Controllo specifico per i campi nome/name
    console.log('\n🔍 Controllo campi nome/name:');
    const nameFields = structureResult.rows.filter(row => 
      row.column_name.toLowerCase().includes('nome') || 
      row.column_name.toLowerCase().includes('name')
    );
    
    if (nameFields.length > 0) {
      nameFields.forEach(field => {
        console.log(`✅ Campo trovato: ${field.column_name} (${field.data_type})`);
      });
    } else {
      console.log('❌ Nessun campo nome/name trovato');
    }
    
    // Controllo alcuni record per vedere i dati reali
    console.log('\n🔍 Controllo dati reali:');
    const sampleQuery = `
      SELECT id, nome, name, cognome, email, ruolo
      FROM users 
      LIMIT 3
    `;
    
    try {
      const sampleResult = await pool.query(sampleQuery);
      console.log('📊 Campioni di dati:');
      sampleResult.rows.forEach((row, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  nome: ${row.nome || 'NULL'}`);
        console.log(`  name: ${row.name || 'NULL'}`);
        console.log(`  cognome: ${row.cognome || 'NULL'}`);
        console.log(`  email: ${row.email || 'NULL'}`);
        console.log(`  ruolo: ${row.ruolo || 'NULL'}`);
        console.log('');
      });
    } catch (error) {
      console.log('❌ Errore nel leggere i dati:');
      if (error.message.includes('nome')) {
        console.log('  - Campo "nome" NON esiste');
      }
      if (error.message.includes('name')) {
        console.log('  - Campo "name" NON esiste');
      }
    }
    
  } catch (error) {
    console.error('❌ Errore nel controllo struttura:', error);
  } finally {
    await pool.end();
  }
}

checkUserFields();
