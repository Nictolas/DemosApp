require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function addUpdatedAtColumn() {
  console.log('🔧 Aggiungendo colonna updated_at...');
  
  try {
    // Verifica se la colonna updated_at esiste già
    const { rows: existingColumns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'updated_at'
    `);
    
    if (existingColumns.length > 0) {
      console.log('⏭️  Colonna updated_at già esistente');
      return;
    }
    
    // Aggiungi la colonna updated_at
    const alterQuery = `
      ALTER TABLE users 
      ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    `;
    
    await pool.query(alterQuery);
    console.log('✅ Aggiunta colonna: updated_at (TIMESTAMP WITH TIME ZONE)');
    
    // Aggiungi un trigger per aggiornare automaticamente updated_at
    const triggerFunctionQuery = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;
    
    await pool.query(triggerFunctionQuery);
    console.log('✅ Creata funzione trigger per updated_at');
    
    // Crea il trigger
    const triggerQuery = `
      CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `;
    
    await pool.query(triggerQuery);
    console.log('✅ Creato trigger per aggiornare automaticamente updated_at');
    
    console.log('\n🎉 Colonna updated_at aggiunta con successo!');
    console.log('🔍 Per verificare la nuova struttura, esegui:');
    console.log('   npm run check-users-structure');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta della colonna updated_at:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Esegui l'aggiunta della colonna
addUpdatedAtColumn();
