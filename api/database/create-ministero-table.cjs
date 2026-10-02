const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function createMinisteroTable() {
  console.log('🏗️ Creazione tabella iniziative_ministero...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');

    // Leggi lo script SQL
    const sqlPath = path.join(__dirname, 'create-ministero-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Esecuzione script SQL...');
    
    // Esegui lo script
    await client.query(sql);
    
    console.log('✅ Tabella iniziative_ministero creata con successo!');
    
    // Verifica che la tabella esista
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'iniziative_ministero'
      ORDER BY ordinal_position;
    `;
    
    const result = await client.query(verifyQuery);
    
    console.log('\n📊 Struttura tabella creata:');
    console.log('─'.repeat(80));
    result.rows.forEach((row, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} ${row.is_nullable}`);
    });
    console.log('─'.repeat(80));
    
    // Verifica indici
    const indexQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'iniziative_ministero';
    `;
    
    const indexes = await client.query(indexQuery);
    
    if (indexes.rows.length > 0) {
      console.log('\n🔍 Indici creati:');
      indexes.rows.forEach((idx, index) => {
        console.log(`${index + 1}. ${idx.indexname}`);
      });
    }
    
    client.release();
    
    console.log('\n✅ Setup completato con successo!');
    console.log('\n🎯 Prossimi passi:');
    console.log('   1. Testare la sincronizzazione: POST /api/ministero/sync');
    console.log('   2. Verificare i dati: GET /api/ministero/database');
    
  } catch (error) {
    console.error('❌ Errore nella creazione della tabella:', error);
    
    if (error.message.includes('already exists')) {
      console.log('⚠️ La tabella esiste già. Vuoi ricrearla?');
    }
    
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui
createMinisteroTable()
  .then(() => {
    console.log('\n✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore:', error.message);
    process.exit(1);
  });

