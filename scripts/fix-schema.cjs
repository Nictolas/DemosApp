const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

async function fixSchema() {
  console.log('🔧 Correggendo schema database...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // Correzioni schema
    const fixes = [
      // Tabella utenti - aggiungi colonna sesso
      `ALTER TABLE utenti ADD COLUMN IF NOT EXISTS sesso VARCHAR(20)`,
      
      // Tabella opinioni - aggiungi colonna utente_id se mancante
      `ALTER TABLE opinioni ADD COLUMN IF NOT EXISTS utente_id VARCHAR(255)`,
      
      // Tabella opinioni_proposte - aggiungi colonna utente_id se mancante
      `ALTER TABLE opinioni_proposte ADD COLUMN IF NOT EXISTS utente_id VARCHAR(255)`,
      
      // Tabella voti_capo_stato - aggiungi colonna utente_id se mancante
      `ALTER TABLE voti_capo_stato ADD COLUMN IF NOT EXISTS utente_id VARCHAR(255)`,
      
      // Tabella admin_notifications - aggiungi colonna tipo se mancante
      `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'generica'`,
      
      // Tabella elezioni - aggiungi colonna titolo se mancante
      `ALTER TABLE elezioni ADD COLUMN IF NOT EXISTS titolo TEXT`,
      
      // Tabella iniziative_popolari - aggiungi colonna titolo se mancante
      `ALTER TABLE iniziative_popolari ADD COLUMN IF NOT EXISTS titolo TEXT`,
      
      // Tabella ice - aggiungi colonna titolo se mancante
      `ALTER TABLE ice ADD COLUMN IF NOT EXISTS titolo TEXT`,
      
      // Tabella voti_iniziative_popolari - aggiungi colonna utente_id se mancante
      `ALTER TABLE voti_iniziative_popolari ADD COLUMN IF NOT EXISTS utente_id VARCHAR(255)`,
      
      // Tabella voti_referendum_abrogativi - aggiungi colonna utente_id se mancante
      `ALTER TABLE voti_referendum_abrogativi ADD COLUMN IF NOT EXISTS utente_id VARCHAR(255)`,
      
      // Aggiungi indici per migliorare le performance
      `CREATE INDEX IF NOT EXISTS idx_utenti_email ON utenti(email)`,
      `CREATE INDEX IF NOT EXISTS idx_opinioni_utente_id ON opinioni(utente_id)`,
      `CREATE INDEX IF NOT EXISTS idx_voti_utente_id ON voti_capo_stato(utente_id)`,
      `CREATE INDEX IF NOT EXISTS idx_notifiche_utente_id ON admin_notifications(destinatario_id)`
    ];
    
    console.log('🔧 Applicando correzioni schema...');
    
    for (let i = 0; i < fixes.length; i++) {
      try {
        await client.query(fixes[i]);
        console.log(`✅ Correzione ${i + 1}/${fixes.length} applicata`);
      } catch (error) {
        console.log(`⚠️ Correzione ${i + 1} saltata:`, error.message);
      }
    }
    
    // Verifica schema aggiornato
    console.log('\n📊 Verifica schema aggiornato...');
    
    const tables = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('utenti', 'opinioni', 'opinioni_proposte', 'voti_capo_stato', 'admin_notifications', 'elezioni', 'iniziative_popolari', 'ice')
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('\n📋 Struttura tabelle principali:');
    let currentTable = '';
    tables.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n📁 ${currentTable}:`);
      }
      console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
    });
    
    console.log('\n🎉 Schema corretto con successo!');
    console.log('🚀 Ora puoi rieseguire la migrazione completa');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Errore durante la correzione dello schema:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixSchema();
