const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addPoliticalOpinionsConsentColumns() {
  try {
    console.log('🔧 Aggiunta colonne per consenso opinioni politiche alla tabella users...');
    
    const client = await pool.connect();
    
    // Verifica se le colonne esistono già
    const columnsToAdd = [
      { name: 'political_opinions_consent', type: 'BOOLEAN DEFAULT false', description: 'Consenso esplicito per opinioni politiche (GDPR Art. 9)' },
      { name: 'political_opinions_consent_timestamp', type: 'TIMESTAMP WITH TIME ZONE', description: 'Data e ora del consenso' },
      { name: 'political_opinions_consent_ip_address', type: 'VARCHAR(45)', description: 'Indirizzo IP al momento del consenso' },
      { name: 'political_opinions_consent_user_agent', type: 'TEXT', description: 'User agent al momento del consenso' }
    ];
    
    for (const column of columnsToAdd) {
      const columnExists = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = $1
        );
      `, [column.name]);
      
      if (columnExists.rows[0].exists) {
        console.log(`✅ La colonna ${column.name} esiste già`);
      } else {
        // Aggiungi la colonna
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN ${column.name} ${column.type}
        `);
        console.log(`✅ Colonna ${column.name} aggiunta con successo (${column.description})`);
      }
    }
    
    // Aggiungi un indice per migliorare le performance delle ricerche
    const indexExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_political_opinions_consent'
      );
    `);
    
    if (!indexExists.rows[0].exists) {
      await client.query(`
        CREATE INDEX idx_users_political_opinions_consent 
        ON users(political_opinions_consent)
        WHERE political_opinions_consent = true
      `);
      console.log('✅ Indice su political_opinions_consent creato');
    } else {
      console.log('✅ Indice su political_opinions_consent esiste già');
    }
    
    client.release();
    console.log('✅ Migrazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore nella migrazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addPoliticalOpinionsConsentColumns();

