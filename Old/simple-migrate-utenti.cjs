const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function simpleMigrateUtenti() {
  try {
    console.log('🔍 Migrazione semplice da utenti a users...');
    
    // 1. Ottieni i dati dalla tabella utenti
    const utentiData = await pool.query('SELECT * FROM utenti');
    console.log(`📊 Trovati ${utentiData.rows.length} record in utenti`);
    
    if (utentiData.rows.length === 0) {
      console.log('⚠️ Nessun dato da migrare');
      return;
    }
    
    // 2. Per ogni utente, aggiorna o crea in users
    for (const utente of utentiData.rows) {
      console.log(`🔄 Processando: ${utente.email || utente.id}`);
      
      // Controlla se esiste già per email
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [utente.email]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`  ⚠️ Utente già esistente, aggiorno dati base...`);
        
        // Aggiorna solo i campi essenziali
        await pool.query(`
          UPDATE users SET 
            nome = COALESCE($1, nome),
            cognome = COALESCE($2, cognome),
            data_nascita = COALESCE($3, data_nascita),
            genere = COALESCE($4, genere),
            updated_at = CURRENT_TIMESTAMP
          WHERE email = $5
        `, [
          utente.nome,
          utente.cognome,
          utente.data_nascita,
          utente.sesso,
          utente.email
        ]);
      } else {
        console.log(`  ➕ Creazione nuovo utente...`);
        
        // Crea nuovo utente con campi essenziali
        const newId = require('crypto').randomUUID();
        
        await pool.query(`
          INSERT INTO users (
            id, email, nome, cognome, data_nascita, genere, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          newId,
          utente.email,
          utente.nome,
          utente.cognome,
          utente.data_nascita,
          utente.sesso,
          utente.status || 'active',
          utente.created_at || new Date(),
          new Date()
        ]);
        
        // Salva mapping per foreign key
        await pool.query(`
          CREATE TEMP TABLE IF NOT EXISTS id_mapping (
            old_id VARCHAR(255),
            new_id UUID
          )
        `);
        
        await pool.query(
          'INSERT INTO id_mapping (old_id, new_id) VALUES ($1, $2)',
          [utente.id, newId]
        );
      }
    }
    
    console.log('✅ Migrazione dati base completata');
    
    // 3. Aggiorna le foreign key
    console.log('🔗 Aggiornamento foreign key...');
    
    try {
      // consenso_governo
      await pool.query(`
        UPDATE consenso_governo 
        SET userid = (SELECT new_id FROM id_mapping WHERE old_id = consenso_governo.userid)
        WHERE userid IN (SELECT old_id FROM id_mapping)
      `);
      console.log('  ✅ consenso_governo aggiornata');
    } catch (error) {
      console.log('  ⚠️ Errore consenso_governo:', error.message);
    }
    
    try {
      // consenso_capo_stato
      await pool.query(`
        UPDATE consenso_capo_stato 
        SET userid = (SELECT new_id FROM id_mapping WHERE old_id = consenso_capo_stato.userid)
        WHERE userid IN (SELECT old_id FROM id_mapping)
      `);
      console.log('  ✅ consenso_capo_stato aggiornata');
    } catch (error) {
      console.log('  ⚠️ Errore consenso_capo_stato:', error.message);
    }
    
    try {
      // notifiche_utente
      await pool.query(`
        UPDATE notifiche_utente 
        SET utente_id = (SELECT new_id FROM id_mapping WHERE old_id = notifiche_utente.utente_id)
        WHERE utente_id IN (SELECT old_id FROM id_mapping)
      `);
      console.log('  ✅ notifiche_utente aggiornata');
    } catch (error) {
      console.log('  ⚠️ Errore notifiche_utente:', error.message);
    }
    
    try {
      // segnalazioni
      await pool.query(`
        UPDATE segnalazioni 
        SET utente_id = (SELECT new_id FROM id_mapping WHERE old_id = segnalazioni.utente_id),
            risolto_da = (SELECT new_id FROM id_mapping WHERE old_id = segnalazioni.risolto_da)
        WHERE utente_id IN (SELECT old_id FROM id_mapping) OR risolto_da IN (SELECT old_id FROM id_mapping)
      `);
      console.log('  ✅ segnalazioni aggiornata');
    } catch (error) {
      console.log('  ⚠️ Errore segnalazioni:', error.message);
    }
    
    // 4. Elimina la tabella utenti
    console.log('🗑️ Eliminazione tabella utenti...');
    await pool.query('DROP TABLE IF EXISTS utenti CASCADE');
    console.log('✅ Tabella utenti eliminata');
    
    // 5. Verifica finale
    const finalCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Record finali in users: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

simpleMigrateUtenti()
  .then(() => {
    console.log('🎉 Migrazione completata con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante la migrazione:', error);
    process.exit(1);
  });
