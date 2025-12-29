const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTables() {
  try {
    console.log('🚀 Creazione tabelle ministeri su Neon...');
    
    const ministeri = [
      'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
      'cultura', 'sport'
    ];
    
    for (const ministero of ministeri) {
      const tableName = `voti_ministro_${ministero}`;
      
      const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          nome_ministro VARCHAR(255) NOT NULL,
          nome_display VARCHAR(255) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_${tableName}_userid ON ${tableName}(userid);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_timestamp ON ${tableName}(timestamp);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_nome_ministro ON ${tableName}(nome_ministro);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_nome_display ON ${tableName}(nome_display);
      `;
      
      await pool.query(sql);
      console.log(`✅ ${tableName} creata`);
    }
    
    console.log('🎉 Tutte le tabelle create!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

createTables();
