require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testIstituzioneNotifiche() {
  console.log('🧪 TEST: Sistema Notifiche Istituzione\n');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connesso al database\n');

    // TEST 1: Verifica struttura tabella comunicazioni
    console.log('📋 TEST 1: Verifica struttura tabella comunicazioni');
    const structureResult = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'comunicazioni' 
      AND column_name IN ('id', 'tipo', 'read_by', 'titolo', 'testo', 'id_utente', 'voto_dato')
      ORDER BY column_name
    `);
    
    console.log('Colonne trovate:');
    structureResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.udt_name || 'N/A'})`);
    });
    
    const hasTipo = structureResult.rows.some(r => r.column_name === 'tipo');
    const hasReadBy = structureResult.rows.some(r => r.column_name === 'read_by');
    
    if (!hasTipo) {
      console.log('⚠️ Colonna "tipo" non trovata');
    } else {
      console.log('✅ Colonna "tipo" presente');
    }
    
    if (!hasReadBy) {
      console.log('⚠️ Colonna "read_by" non trovata');
    } else {
      console.log('✅ Colonna "read_by" presente');
    }
    console.log('');

    // TEST 2: Verifica utenti con rappresentante_comune
    console.log('👥 TEST 2: Verifica utenti con rappresentante_comune');
    const rappresentantiResult = await client.query(`
      SELECT 
        r.id::text as rappresentante_id,
        r.nome || ' ' || r.cognome as rappresentante_nome,
        COUNT(u.id) as num_utenti
      FROM users r
      LEFT JOIN users u ON u.rappresentante_comune::text = r.id::text
      WHERE r.ruolo IN ('P', 'CP')
      GROUP BY r.id, r.nome, r.cognome
      HAVING COUNT(u.id) > 0
      ORDER BY num_utenti DESC
      LIMIT 5
    `);
    
    if (rappresentantiResult.rows.length === 0) {
      console.log('⚠️ Nessun rappresentante con utenti associati trovato');
      console.log('💡 Crea alcuni utenti con rappresentante_comune per testare le notifiche');
    } else {
      console.log('Rappresentanti con utenti associati:');
      rappresentantiResult.rows.forEach(row => {
        console.log(`  - ${row.rappresentante_nome}: ${row.num_utenti} utenti`);
      });
    }
    console.log('');

    // TEST 3: Verifica utenti con FCM tokens e rappresentante_comune
    console.log('📱 TEST 3: Verifica utenti con FCM tokens e rappresentante_comune');
      const utentiConFcmResult = await client.query(`
      SELECT 
        u.id,
        u.nome || ' ' || u.cognome as nome_utente,
        u.rappresentante_comune,
        r.nome || ' ' || r.cognome as rappresentante_nome,
        array_length(u.fcm_tokens, 1) as num_tokens,
        u.notifiche_preferenze->>'istituzione' as preferenza_istituzione
      FROM users u
      LEFT JOIN users r ON (r.id::text = u.rappresentante_comune::text OR r.id = u.rappresentante_comune::uuid)
      WHERE u.rappresentante_comune IS NOT NULL
        AND u.fcm_tokens IS NOT NULL
        AND array_length(u.fcm_tokens, 1) > 0
      LIMIT 5
    `);
    
    if (utentiConFcmResult.rows.length === 0) {
      console.log('⚠️ Nessun utente con rappresentante_comune e FCM tokens trovato');
      console.log('💡 Gli utenti devono avere:');
      console.log('   1. rappresentante_comune impostato');
      console.log('   2. fcm_tokens non vuoto');
    } else {
      console.log('Utenti pronti a ricevere notifiche istituzione:');
      utentiConFcmResult.rows.forEach(row => {
        console.log(`  - ${row.nome_utente}:`);
        console.log(`      Rappresentante: ${row.rappresentante_nome || 'N/A'}`);
        console.log(`      FCM Tokens: ${row.num_tokens}`);
        console.log(`      Preferenza istituzione: ${row.preferenza_istituzione || 'NULL (default: attiva)'}`);
      });
    }
    console.log('');

    // TEST 4: Verifica comunicazioni tipo "istituzione" esistenti
    console.log('📝 TEST 4: Verifica comunicazioni tipo "istituzione" esistenti');
    const comunicazioniIstituzioneResult = await client.query(`
      SELECT 
        id,
        titolo,
        id_utente,
        voto_dato,
        data_creazione,
        array_length(read_by, 1) as num_letti
      FROM comunicazioni
      WHERE tipo = 'istituzione'
      ORDER BY data_creazione DESC
      LIMIT 5
    `);
    
    if (comunicazioniIstituzioneResult.rows.length === 0) {
      console.log('ℹ️ Nessuna comunicazione tipo "istituzione" trovata');
    } else {
      console.log(`Trovate ${comunicazioniIstituzioneResult.rows.length} comunicazioni istituzione:`);
      comunicazioniIstituzioneResult.rows.forEach(row => {
        console.log(`  - ${row.titolo}:`);
        console.log(`      Voto: ${row.voto_dato || 'N/A'}`);
        console.log(`      Data: ${row.data_creazione}`);
        console.log(`      Letti: ${row.num_letti || 0}`);
      });
    }
    console.log('');

    // TEST 5: Simula creazione comunicazione istituzione
    console.log('🔬 TEST 5: Simula creazione comunicazione istituzione');
    
    // Trova un rappresentante valido
    const rappresentanteTest = await client.query(`
      SELECT id, nome, cognome
      FROM users
      WHERE ruolo IN ('P', 'CP')
      LIMIT 1
    `);
    
    if (rappresentanteTest.rows.length === 0) {
      console.log('⚠️ Nessun rappresentante trovato per il test');
      console.log('💡 Crea almeno un utente con ruolo P o CP');
    } else {
      const rappresentante = rappresentanteTest.rows[0];
      console.log(`✅ Rappresentante trovato: ${rappresentante.nome} ${rappresentante.cognome}`);
      
      // Trova utenti con questo rappresentante (gestisce sia UUID che TEXT)
      // Prima verifica il tipo di rappresentante_comune
      const rappresentanteComuneType = await client.query(`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'rappresentante_comune'
      `);
      
      const isUUID = rappresentanteComuneType.rows.length > 0 && 
                     (rappresentanteComuneType.rows[0].udt_name === 'uuid' || 
                      rappresentanteComuneType.rows[0].data_type === 'uuid');
      
      const utentiDestinatari = isUUID 
        ? await client.query(`
            SELECT id, nome, cognome, fcm_tokens
            FROM users
            WHERE rappresentante_comune = $1::uuid
              AND (status = 'active' OR status IS NULL)
              AND fcm_tokens IS NOT NULL
              AND array_length(fcm_tokens, 1) > 0
          `, [rappresentante.id])
        : await client.query(`
            SELECT id, nome, cognome, fcm_tokens
            FROM users
            WHERE rappresentante_comune::text = $1::text
              AND (status = 'active' OR status IS NULL)
              AND fcm_tokens IS NOT NULL
              AND array_length(fcm_tokens, 1) > 0
          `, [rappresentante.id]);
      
      console.log(`📊 Utenti che riceverebbero la notifica: ${utentiDestinatari.rows.length}`);
      
      if (utentiDestinatari.rows.length > 0) {
        console.log('Utenti destinatari:');
        utentiDestinatari.rows.forEach(u => {
          console.log(`  - ${u.nome} ${u.cognome}: ${u.fcm_tokens.length} token(s) FCM`);
        });
      } else {
        console.log('⚠️ Nessun utente destinatario trovato');
        console.log('💡 Verifica che ci siano utenti con:');
        console.log('   1. rappresentante_comune = ' + rappresentante.id);
        console.log('   2. fcm_tokens non vuoto');
      }
    }
    console.log('');

    // TEST 6: Verifica che la tabella notifiche_utente non sia più usata
    console.log('🗑️ TEST 6: Verifica tabella notifiche_utente');
    const notificheUtenteCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifiche_utente'
      ) as table_exists
    `);
    
    if (notificheUtenteCheck.rows[0].table_exists) {
      console.log('⚠️ Tabella notifiche_utente esiste ancora');
      console.log('💡 Esegui remove_notifiche_utente_table.sql per rimuoverla');
    } else {
      console.log('✅ Tabella notifiche_utente non esiste (corretto)');
    }
    console.log('');

    // TEST 7: Verifica query per notifiche (GET /api/notifiche)
    console.log('🔔 TEST 7: Verifica query notifiche');
    
    // Trova un utente di test
    const utenteTest = await client.query(`
      SELECT id, nome, cognome
      FROM users
      WHERE (status = 'active' OR status IS NULL)
      LIMIT 1
    `);
    
    if (utenteTest.rows.length === 0) {
      console.log('⚠️ Nessun utente trovato per il test');
    } else {
      const utente = utenteTest.rows[0];
      console.log(`✅ Utente di test: ${utente.nome} ${utente.cognome}`);
      
      // Verifica tipo read_by
      const readByTypeCheck = await client.query(`
        SELECT udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' 
        AND column_name = 'read_by'
      `);
      
      const isUUIDArray = readByTypeCheck.rows.length > 0 && readByTypeCheck.rows[0].udt_name?.includes('uuid');
      
      const isReadQuery = isUUIDArray ? `
        SELECT
          c.*,
          CASE 
            WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
            WHEN $1::uuid = ANY(c.read_by) THEN true
            ELSE false
          END as is_read
        FROM comunicazioni c
        WHERE c.tipo IN ('demos_notification', 'new_opinions', 'istituzione')
        ORDER BY c.data_creazione DESC
        LIMIT 10
      ` : `
        SELECT
          c.*,
          CASE 
            WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
            WHEN c.read_by::text[] @> ARRAY[$1::text] THEN true
            ELSE false
          END as is_read
        FROM comunicazioni c
        WHERE c.tipo IN ('demos_notification', 'new_opinions', 'istituzione')
        ORDER BY c.data_creazione DESC
        LIMIT 10
      `;
      
      const notificheResult = await client.query(isReadQuery, [utente.id]);
      
      console.log(`📋 Notifiche trovate: ${notificheResult.rows.length}`);
      const nonLette = notificheResult.rows.filter(n => !n.is_read);
      console.log(`📊 Notifiche non lette: ${nonLette.length}`);
      
      if (notificheResult.rows.length > 0) {
        console.log('Dettaglio notifiche:');
        notificheResult.rows.slice(0, 3).forEach(n => {
          console.log(`  - ${n.titolo}:`);
          console.log(`      Tipo: ${n.tipo}`);
          console.log(`      Letta: ${n.is_read ? 'Sì' : 'No'}`);
        });
      }
    }
    console.log('');

    console.log('✅ TEST COMPLETATI\n');
    console.log('📋 RIEPILOGO:');
    console.log('  1. ✅ Struttura tabella comunicazioni verificata');
    console.log('  2. ✅ Rappresentanti e utenti associati verificati');
    console.log('  3. ✅ Utenti con FCM tokens verificati');
    console.log('  4. ✅ Comunicazioni istituzione verificate');
    console.log('  5. ✅ Simulazione creazione comunicazione completata');
    console.log('  6. ✅ Tabella notifiche_utente verificata');
    console.log('  7. ✅ Query notifiche verificate');
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testIstituzioneNotifiche();

