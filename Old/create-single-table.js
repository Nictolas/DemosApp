const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createSingleTable() {
  try {
    console.log('🚀 Creazione tabella voti_ministro_difesa...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS voti_ministro_difesa (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nome_ministro VARCHAR(255) NOT NULL,
        nome_display VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_userid ON voti_ministro_difesa(userid);
      CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_timestamp ON voti_ministro_difesa(timestamp);
      CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_nome_ministro ON voti_ministro_difesa(nome_ministro);
      CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_nome_display ON voti_ministro_difesa(nome_display);
    `;
    
    await pool.query(sql);
    console.log('✅ Tabella voti_ministro_difesa creata con successo!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

createSingleTable();
