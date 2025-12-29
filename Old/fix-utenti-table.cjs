const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixUtentiTable() {
  try {
    console.log('🔧 Iniziando la correzione della tabella utenti...');
    
    // 1. Aggiungi la colonna password_hash se non esiste
    console.log('📝 Aggiungendo colonna password_hash...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
    `);
    
    // 2. Aggiungi la colonna password se non esiste (per compatibilità)
    console.log('📝 Aggiungendo colonna password...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS password VARCHAR(255)
    `);
    
    // 3. Aggiungi la colonna ruolo se non esiste
    console.log('📝 Aggiungendo colonna ruolo...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS ruolo VARCHAR(50)
    `);
    
    // 4. Aggiungi la colonna fcm_tokens se non esiste
    console.log('📝 Aggiungendo colonna fcm_tokens...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS fcm_tokens TEXT[]
    `);
    
    // 5. Aggiungi la colonna notifiche_preferenze se non esiste
    console.log('📝 Aggiungendo colonna notifiche_preferenze...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS notifiche_preferenze JSONB DEFAULT '{}'::jsonb
    `);
    
    // 6. Aggiungi la colonna avatar_config se non esiste
    console.log('📝 Aggiungendo colonna avatar_config...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT '{}'::jsonb
    `);
    
    // 7. Aggiungi la colonna premium se non esiste
    console.log('📝 Aggiungendo colonna premium...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT false
    `);
    
    // 8. Aggiungi la colonna provincia_residenza se non esiste
    console.log('📝 Aggiungendo colonna provincia_residenza...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS provincia_residenza VARCHAR(100)
    `);
    
    // 9. Aggiungi la colonna regione_residenza se non esiste
    console.log('📝 Aggiungendo colonna regione_residenza...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS regione_residenza VARCHAR(100)
    `);
    
    // 10. Aggiungi la colonna provincia_elezione se non esiste
    console.log('📝 Aggiungendo colonna provincia_elezione...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS provincia_elezione VARCHAR(100)
    `);
    
    // 11. Aggiungi la colonna regione_elezione se non esiste
    console.log('📝 Aggiungendo colonna regione_elezione...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS regione_elezione VARCHAR(100)
    `);
    
    // 12. Aggiungi la colonna paese_residenza se non esiste
    console.log('📝 Aggiungendo colonna paese_residenza...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS paese_residenza VARCHAR(100)
    `);
    
    // 13. Aggiungi la colonna paese_candidatura se non esiste
    console.log('📝 Aggiungendo colonna paese_candidatura...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS paese_candidatura VARCHAR(100)
    `);
    
    // 14. Aggiungi la colonna provincia_candidatura se non esiste
    console.log('📝 Aggiungendo colonna provincia_candidatura...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS provincia_candidatura VARCHAR(100)
    `);
    
    // 15. Aggiungi la colonna comune_candidatura se non esiste
    console.log('📝 Aggiungendo colonna comune_candidatura...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS comune_candidatura VARCHAR(100)
    `);
    
    // 16. Aggiungi la colonna grado_candidatura se non esiste
    console.log('📝 Aggiungendo colonna grado_candidatura...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS grado_candidatura VARCHAR(100)
    `);
    
    // 17. Aggiungi la colonna firestore_uid se non esiste
    console.log('📝 Aggiungendo colonna firestore_uid...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS firestore_uid VARCHAR(255)
    `);
    
    // 18. Aggiungi la colonna rappresentante_europeo se non esiste
    console.log('📝 Aggiungendo colonna rappresentante_europeo...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS rappresentante_europeo VARCHAR(255)
    `);
    
    // 19. Aggiungi la colonna rappresentante_camera se non esiste
    console.log('📝 Aggiungendo colonna rappresentante_camera...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS rappresentante_camera VARCHAR(255)
    `);
    
    // 20. Aggiungi la colonna rappresentante_senato se non esiste
    console.log('📝 Aggiungendo colonna rappresentante_senato...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS rappresentante_senato VARCHAR(255)
    `);
    
    // 21. Aggiungi la colonna rappresentante_regionale se non esiste
    console.log('📝 Aggiungendo colonna rappresentante_regionale...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS rappresentante_regionale VARCHAR(255)
    `);
    
    // 22. Aggiungi la colonna rappresentante_comune se non esiste
    console.log('📝 Aggiungendo colonna rappresentante_comune...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS rappresentante_comune VARCHAR(255)
    `);
    
    // 23. Aggiungi la colonna candidato_europeo se non esiste
    console.log('📝 Aggiungendo colonna candidato_europeo...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS candidato_europeo VARCHAR(255)
    `);
    
    // 24. Aggiungi la colonna candidato_camera se non esiste
    console.log('📝 Aggiungendo colonna candidato_camera...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS candidato_camera VARCHAR(255)
    `);
    
    // 25. Aggiungi la colonna candidato_senato se non esiste
    console.log('📝 Aggiungendo colonna candidato_senato...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS candidato_senato VARCHAR(255)
    `);
    
    // 26. Aggiungi la colonna candidato_regionale se non esiste
    console.log('📝 Aggiungendo colonna candidato_regionale...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS candidato_regionale VARCHAR(255)
    `);
    
    // 27. Aggiungi la colonna candidato_comune se non esiste
    console.log('📝 Aggiungendo colonna candidato_comune...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS candidato_comune VARCHAR(255)
    `);
    
    // 28. Aggiungi la colonna fonti_opinioni se non esiste
    console.log('📝 Aggiungendo colonna fonti_opinioni...');
    await pool.query(`
      ALTER TABLE utenti 
      ADD COLUMN IF NOT EXISTS fonti_opinioni TEXT
    `);
    
    // 29. Verifica la struttura della tabella
    console.log('🔍 Verificando struttura tabella...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'utenti' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Struttura tabella utenti:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // 30. Controlla se ci sono utenti esistenti
    const userCount = await pool.query('SELECT COUNT(*) FROM utenti');
    console.log(`👥 Numero totale utenti: ${userCount.rows[0].count}`);
    
    // 31. Mostra alcuni esempi di utenti (se esistono)
    if (parseInt(userCount.rows[0].count) > 0) {
      const sampleUsers = await pool.query('SELECT id, email, nome, cognome, ruolo FROM utenti LIMIT 5');
      console.log('📋 Esempi utenti:');
      sampleUsers.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.nome} ${user.cognome}) - Ruolo: ${user.ruolo || 'Non definito'}`);
      });
    } else {
      console.log('📋 Nessun utente presente nella tabella');
    }
    
    console.log('✅ Correzione tabella utenti completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la correzione:', error);
  } finally {
    await pool.end();
  }
}

fixUtentiTable();
