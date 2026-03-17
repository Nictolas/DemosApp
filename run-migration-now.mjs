import pg from 'pg';
const { Client } = pg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connesso al database');
    
    console.log('📝 Creando colonna attivisti...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS attivisti VARCHAR(255) DEFAULT NULL
    `);
    
    console.log('📝 Creando colonna organizzazioni...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS organizzazioni VARCHAR(255) DEFAULT NULL
    `);
    
    console.log('📝 Creando indici...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_attivisti ON users (attivisti)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni)`);
    
    console.log('✅ Colonne create con successo!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await client.end();
  }
}

runMigration();

