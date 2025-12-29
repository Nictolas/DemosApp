const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Lista dei ministeri
const ministeri = [
  'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
  'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
  'cultura', 'sport'
];

async function checkAndCreateTables() {
  try {
    console.log('🔍 Controllo tabelle ministeri su Neon...\n');
    
    let tablesToCreate = [];
    
    // Verifica quali tabelle esistono
    for (const ministero of ministeri) {
      const tableName = `voti_ministro_${ministero}`;
      
      try {
        const tableExistsQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `;
        
        const result = await pool.query(tableExistsQuery, [tableName]);
        const exists = result.rows[0].exists;
        
        if (exists) {
          console.log(`✅ ${tableName} - ESISTE`);
        } else {
          console.log(`❌ ${tableName} - NON ESISTE`);
          tablesToCreate.push(ministero);
        }
        
      } catch (error) {
        console.log(`❌ ${tableName} - ERRORE: ${error.message}`);
        tablesToCreate.push(ministero);
      }
    }
    
    // Se ci sono tabelle da creare, le creo
    if (tablesToCreate.length > 0) {
      console.log(`\n🚀 Creazione di ${tablesToCreate.length} tabelle mancanti...\n`);
      
      for (const ministero of tablesToCreate) {
        const tableName = `voti_ministro_${ministero}`;
        
        console.log(`📋 Creazione tabella: ${tableName}`);
        
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            nome_ministro VARCHAR(255) NOT NULL,
            nome_display VARCHAR(255) NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        await pool.query(createTableQuery);
        
        // Creazione indici per performance
        const createIndexesQuery = `
          CREATE INDEX IF NOT EXISTS idx_${tableName}_userid ON ${tableName}(userid);
          CREATE INDEX IF NOT EXISTS idx_${tableName}_timestamp ON ${tableName}(timestamp);
          CREATE INDEX IF NOT EXISTS idx_${tableName}_nome_ministro ON ${tableName}(nome_ministro);
          CREATE INDEX IF NOT EXISTS idx_${tableName}_nome_display ON ${tableName}(nome_display);
        `;
        
        await pool.query(createIndexesQuery);
        
        console.log(`✅ Tabella ${tableName} creata con successo`);
      }
      
      console.log('\n🎉 Tutte le tabelle sono state create!');
    } else {
      console.log('\n✅ Tutte le tabelle esistono già!');
    }
    
    // Verifica finale
    console.log('\n📊 Verifica finale:');
    for (const ministero of ministeri) {
      const tableName = `voti_ministro_${ministero}`;
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
        const countResult = await pool.query(countQuery);
        const count = parseInt(countResult.rows[0].count);
        console.log(`📋 ${tableName}: ${count} record`);
      } catch (error) {
        console.log(`❌ ${tableName}: ERRORE - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkAndCreateTables();
