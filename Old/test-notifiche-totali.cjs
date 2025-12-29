/**
 * Script di test per verificare l'endpoint /api/notifiche-totali
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { getPool } = require('./api/config/database');

async function testNotificheTotali() {
  console.log('🧪 TEST: Verifica endpoint /api/notifiche-totali\n');
  
  const pool = getPool();
  
  try {
    // TEST 1: Verifica connessione database
    console.log('📋 TEST 1: Verifica connessione database');
    const testConnection = await pool.query('SELECT NOW()');
    console.log('✅ Connessione database OK\n');
    
    // TEST 2: Verifica esistenza tabelle
    console.log('📋 TEST 2: Verifica esistenza tabelle');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('notifiche_voti_comuni', 'notifiche_demos', 'notifiche_comunali')
      ORDER BY table_name
    `);
    
    const existingTables = tableCheck.rows.map(r => r.table_name);
    console.log(`✅ Tabelle trovate: ${existingTables.length}`);
    existingTables.forEach(t => console.log(`   - ${t}`));
    
    if (existingTables.length === 0) {
      console.log('⚠️  Nessuna tabella trovata. Esegui gli script SQL per creare le tabelle.\n');
    }
    console.log('');
    
    // TEST 3: Verifica struttura colonne per ogni tabella
    for (const table of existingTables) {
      console.log(`📋 TEST 3.${existingTables.indexOf(table) + 1}: Verifica colonne di ${table}`);
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`   Colonne trovate: ${columns.rows.length}`);
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
      console.log('');
    }
    
    // TEST 4: Test query per ogni tabella esistente
    for (const table of existingTables) {
      console.log(`📋 TEST 4.${existingTables.indexOf(table) + 1}: Test query su ${table}`);
      try {
        let query;
        if (table === 'notifiche_voti_comuni') {
          query = `
            SELECT 
              id,
              id_utente,
              titolo,
              testo,
              COALESCE(data, CURRENT_DATE) as data,
              voto,
              comune_residenza,
              politico,
              COALESCE(likes, 0) as likes,
              COALESCE(dislikes, 0) as dislikes
            FROM ${table}
            LIMIT 5
          `;
        } else if (table === 'notifiche_demos') {
          query = `
            SELECT 
              id,
              id_utente,
              titolo,
              testo,
              COALESCE(data, CURRENT_DATE) as data,
              comune_residenza
            FROM ${table}
            LIMIT 5
          `;
        } else if (table === 'notifiche_comunali') {
          query = `
            SELECT 
              id,
              id_utente,
              titolo,
              testo,
              COALESCE(data, CURRENT_DATE) as data,
              comune_residenza,
              COALESCE(likes, 0) as likes,
              COALESCE(dislikes, 0) as dislikes
            FROM ${table}
            LIMIT 5
          `;
        }
        
        const result = await pool.query(query);
        console.log(`   ✅ Query eseguita con successo: ${result.rows.length} righe trovate`);
        if (result.rows.length > 0) {
          console.log(`   Esempio riga:`, JSON.stringify(result.rows[0], null, 2));
        }
      } catch (err) {
        console.error(`   ❌ Errore query ${table}:`, err.message);
        console.error(`   Code: ${err.code}`);
        console.error(`   Detail: ${err.detail}`);
      }
      console.log('');
    }
    
    // TEST 5: Verifica utenti admin
    console.log('📋 TEST 5: Verifica utenti admin');
    const adminUsers = await pool.query(`
      SELECT id, email, nome, cognome, is_admin, ruolo
      FROM users
      WHERE is_admin = true OR ruolo = 'AD'
      LIMIT 5
    `);
    console.log(`✅ Utenti admin trovati: ${adminUsers.rows.length}`);
    adminUsers.rows.forEach(user => {
      console.log(`   - ${user.email} (${user.nome} ${user.cognome}) - Admin: ${user.is_admin}, Ruolo: ${user.ruolo}`);
    });
    console.log('');
    
    if (adminUsers.rows.length === 0) {
      console.log('⚠️  Nessun utente admin trovato. L\'endpoint richiede permessi admin.\n');
    }
    
    console.log('✅ Tutti i test completati!\n');
    console.log('💡 Se ci sono errori, verifica:');
    console.log('   1. Che le tabelle esistano (esegui gli script SQL)');
    console.log('   2. Che le colonne siano corrette');
    console.log('   3. Che ci sia almeno un utente admin');
    console.log('   4. Che il middleware verifyToken funzioni correttamente');
    
  } catch (error) {
    console.error('❌ Errore durante i test:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testNotificheTotali();

