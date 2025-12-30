/**
 * Script di migrazione per spostare le preferenze notifiche
 * dalla colonna JSON notifiche_preferenze in users alla nuova tabella notifiche_preferenze
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function migrateNotifichePreferenze() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Inizio migrazione preferenze notifiche...\n');

    // 1. Verifica se la tabella esiste già
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifiche_preferenze'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ La tabella notifiche_preferenze non esiste!');
      console.log('💡 Esegui prima lo script SQL: database/create-notifiche-preferenze-table.sql');
      return;
    }

    // 2. Verifica se la colonna notifiche_preferenze esiste in users
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'notifiche_preferenze'
      );
    `);

    if (!columnExists.rows[0].exists) {
      console.log('⚠️ La colonna notifiche_preferenze non esiste in users');
      console.log('ℹ️ Nessuna migrazione necessaria');
      return;
    }

    // 3. Conta utenti totali
    const totalUsers = await client.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Utenti totali nel database: ${totalUsers.rows[0].count}`);

    // 4. Conta utenti con preferenze esistenti nella nuova tabella
    const existingPrefs = await client.query('SELECT COUNT(*) FROM notifiche_preferenze');
    console.log(`📊 Preferenze già migrate: ${existingPrefs.rows[0].count}`);

    // 5. Recupera tutti gli utenti con preferenze JSON
    const usersWithPrefs = await client.query(`
      SELECT id, notifiche_preferenze 
      FROM users 
      WHERE notifiche_preferenze IS NOT NULL
        AND notifiche_preferenze::text != 'null'
        AND notifiche_preferenze::text != '{}'
    `);

    console.log(`📊 Utenti con preferenze JSON da migrare: ${usersWithPrefs.rows.length}\n`);

    if (usersWithPrefs.rows.length === 0) {
      console.log('✅ Nessun utente con preferenze da migrare');
      return;
    }

    // 6. Migra i dati
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    await client.query('BEGIN');

    for (const user of usersWithPrefs.rows) {
      try {
        let prefs;
        try {
          // Prova a parsare come JSON
          prefs = typeof user.notifiche_preferenze === 'string' 
            ? JSON.parse(user.notifiche_preferenze)
            : user.notifiche_preferenze;
        } catch (parseError) {
          console.warn(`⚠️ Errore parsing JSON per utente ${user.id}:`, parseError.message);
          prefs = {};
        }

        // Estrai i valori (gestisci sia stringhe "true"/"false" che booleani)
        const demos = prefs.demos === true || prefs.demos === 'true';
        const istituzione = prefs.istituzione === true || prefs.istituzione === 'true';
        // avvistamenti default true se non specificato (per retrocompatibilità)
        const avvistamenti = prefs.avvistamenti !== false && prefs.avvistamenti !== 'false';

        // Verifica se esiste già un record per questo utente
        const existing = await client.query(
          'SELECT id FROM notifiche_preferenze WHERE user_id = $1',
          [user.id]
        );

        if (existing.rows.length > 0) {
          // Aggiorna record esistente
          await client.query(`
            UPDATE notifiche_preferenze 
            SET demos = $1, istituzione = $2, avvistamenti = $3, updated_at = NOW()
            WHERE user_id = $4
          `, [demos, istituzione, avvistamenti, user.id]);
          skipped++;
        } else {
          // Inserisci nuovo record
          await client.query(`
            INSERT INTO notifiche_preferenze (user_id, demos, istituzione, avvistamenti)
            VALUES ($1, $2, $3, $4)
          `, [user.id, demos, istituzione, avvistamenti]);
          migrated++;
        }
      } catch (error) {
        console.error(`❌ Errore migrazione utente ${user.id}:`, error.message);
        errors++;
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Migrazione completata!');
    console.log(`   📝 Migrati: ${migrated}`);
    console.log(`   🔄 Aggiornati: ${skipped}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log(`   📊 Totale processati: ${migrated + skipped + errors}`);

    // 7. Crea record per utenti senza preferenze (con valori di default)
    console.log('\n🔧 Creazione preferenze di default per utenti senza preferenze...');
    
    const usersWithoutPrefs = await client.query(`
      SELECT u.id 
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE np.user_id IS NULL
    `);

    if (usersWithoutPrefs.rows.length > 0) {
      console.log(`📊 Utenti senza preferenze: ${usersWithoutPrefs.rows.length}`);
      
      await client.query('BEGIN');
      
      for (const user of usersWithoutPrefs.rows) {
        try {
          await client.query(`
            INSERT INTO notifiche_preferenze (user_id, demos, istituzione, avvistamenti)
            VALUES ($1, false, false, true)
            ON CONFLICT (user_id) DO NOTHING
          `, [user.id]);
        } catch (error) {
          console.error(`❌ Errore creazione default per utente ${user.id}:`, error.message);
        }
      }
      
      await client.query('COMMIT');
      console.log(`✅ Preferenze di default create per ${usersWithoutPrefs.rows.length} utenti`);
    }

    // 8. Statistiche finali
    const finalStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE demos = true) as demos_count,
        COUNT(*) FILTER (WHERE istituzione = true) as istituzione_count,
        COUNT(*) FILTER (WHERE avvistamenti = true) as avvistamenti_count
      FROM notifiche_preferenze
    `);

    console.log('\n📊 Statistiche finali:');
    console.log(`   Totale preferenze: ${finalStats.rows[0].total}`);
    console.log(`   Demos attive: ${finalStats.rows[0].demos_count}`);
    console.log(`   Istituzione attive: ${finalStats.rows[0].istituzione_count}`);
    console.log(`   Avvistamenti attivi: ${finalStats.rows[0].avvistamenti_count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui la migrazione
migrateNotifichePreferenze()
  .then(() => {
    console.log('\n✅ Script completato con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script fallito:', error);
    process.exit(1);
  });

