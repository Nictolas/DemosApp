require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testNotificheDemos() {
  console.log('🧪 TEST: Sistema Notifiche Demos\n');
  
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
      AND column_name IN ('id', 'tipo', 'read_by', 'titolo', 'testo', 'status')
      ORDER BY column_name
    `);
    
    console.log('Colonne trovate:');
    structureResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.udt_name || 'N/A'})`);
    });
    
    const hasTipo = structureResult.rows.some(r => r.column_name === 'tipo');
    const hasReadBy = structureResult.rows.some(r => r.column_name === 'read_by');
    
    if (!hasTipo) {
      console.log('⚠️ Colonna "tipo" non trovata, la aggiungo...');
      await client.query(`ALTER TABLE comunicazioni ADD COLUMN tipo VARCHAR(50) DEFAULT 'votazione'`);
      console.log('✅ Colonna "tipo" aggiunta');
    }
    
    if (!hasReadBy) {
      console.log('⚠️ Colonna "read_by" non trovata, la aggiungo...');
      // Prova UUID[] prima, poi VARCHAR[]
      try {
        await client.query(`ALTER TABLE comunicazioni ADD COLUMN read_by UUID[] DEFAULT ARRAY[]::UUID[]`);
        console.log('✅ Colonna "read_by" aggiunta come UUID[]');
      } catch (e) {
        await client.query(`ALTER TABLE comunicazioni ADD COLUMN read_by VARCHAR[] DEFAULT ARRAY[]::VARCHAR[]`);
        console.log('✅ Colonna "read_by" aggiunta come VARCHAR[]');
      }
    }
    console.log('');

    // TEST 2: Crea una comunicazione di test
    console.log('📝 TEST 2: Creazione comunicazione di test');
    const testUserId = '5e51ec52-c656-4f4b-a940-425acb873b0b'; // ID utente dai log
    const testTitolo = 'Test Notifica Demos';
    const testMessaggio = 'Questo è un messaggio di test';
    
    // Verifica il tipo di read_by
    const readByType = structureResult.rows.find(r => r.column_name === 'read_by')?.udt_name;
    const isUUIDArray = readByType && readByType.includes('uuid');
    
    console.log(`Tipo read_by rilevato: ${readByType || 'N/A'}`);
    
    // Usa l'ID utente di test come id_utente (può essere NULL se la colonna lo permette)
    // Prima verifica se id_utente può essere NULL
    const idUtenteNullable = await client.query(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'comunicazioni' AND column_name = 'id_utente'
    `);
    
    const canBeNull = idUtenteNullable.rows.length > 0 && idUtenteNullable.rows[0].is_nullable === 'YES';
    const idUtenteValue = canBeNull ? 'NULL' : `'${testUserId}'::uuid`;
    
    console.log(`id_utente può essere NULL: ${canBeNull}`);
    
    const createResult = await client.query(`
      INSERT INTO comunicazioni (
        id, id_utente, titolo, testo, zona, tipo, 
        data_creazione, likes, dislikes, punti_trasparenza, 
        read_by, status
      ) VALUES (
        gen_random_uuid(), ${idUtenteValue}, $1, $2, 'Generale', 'demos_notification',
        NOW(), 0, 0, 0, 
        ${isUUIDArray ? 'ARRAY[]::UUID[]' : 'ARRAY[]::VARCHAR[]'},
        'non_letta'
      ) RETURNING id, read_by, tipo
    `, [`Notifica Demos: ${testTitolo}`, testMessaggio]);
    
    const comunicazioneId = createResult.rows[0].id;
    console.log(`✅ Comunicazione creata con ID: ${comunicazioneId}`);
    console.log(`   Tipo: ${createResult.rows[0].tipo}`);
    console.log(`   read_by: ${JSON.stringify(createResult.rows[0].read_by)}`);
    console.log('');

    // TEST 3: Verifica query is_read
    console.log('🔍 TEST 3: Verifica query is_read');
    // Usa UUID per il confronto se read_by è UUID[]
    const isReadQuery = isUUIDArray ? `
      SELECT
        c.*,
        CASE 
          WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
          WHEN $1::uuid = ANY(c.read_by) THEN true
          ELSE false
        END as is_read
      FROM comunicazioni c
      WHERE c.id = $2
    ` : `
      SELECT
        c.*,
        CASE 
          WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
          WHEN c.read_by::text[] @> ARRAY[$1::text] THEN true
          ELSE false
        END as is_read
      FROM comunicazioni c
      WHERE c.id = $2
    `;
    
    const isReadResult = await client.query(isReadQuery, [testUserId, comunicazioneId]);
    
    if (isReadResult.rows.length > 0) {
      const row = isReadResult.rows[0];
      console.log(`✅ Query is_read eseguita con successo`);
      console.log(`   is_read: ${row.is_read}`);
      console.log(`   read_by: ${JSON.stringify(row.read_by)}`);
      console.log(`   Tipo read_by: ${typeof row.read_by}`);
      
      const expectedStatus = row.is_read ? 'letta' : 'non_letta';
      console.log(`   Status atteso: ${expectedStatus}`);
      
      if (!row.is_read) {
        console.log('✅ La notifica risulta NON LETTA (corretto)');
      } else {
        console.log('❌ La notifica risulta LETTA (dovrebbe essere non letta)');
      }
    } else {
      console.log('❌ Comunicazione non trovata');
    }
    console.log('');

    // TEST 4: Verifica query completa notifiche
    console.log('📋 TEST 4: Verifica query completa notifiche');
    const notificheQuery = isUUIDArray ? `
      SELECT
        c.*,
        CASE 
          WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
          WHEN $1::uuid = ANY(c.read_by) THEN true
          ELSE false
        END as is_read
      FROM comunicazioni c
      WHERE c.tipo IN ('demos_notification', 'new_opinions')
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
      WHERE c.tipo IN ('demos_notification', 'new_opinions')
      ORDER BY c.data_creazione DESC
      LIMIT 10
    `;
    
    const notificheResult = await client.query(notificheQuery, [testUserId]);
    
    console.log(`✅ Trovate ${notificheResult.rows.length} comunicazioni`);
    const nonLette = notificheResult.rows.filter(r => !r.is_read);
    console.log(`   Non lette: ${nonLette.length}`);
    console.log(`   Lette: ${notificheResult.rows.length - nonLette.length}`);
    
    if (nonLette.length > 0) {
      console.log('✅ Ci sono notifiche non lette (corretto per il badge)');
    } else {
      console.log('⚠️ Nessuna notifica non letta trovata');
    }
    console.log('');

    // TEST 5: Verifica utenti con demos: true
    console.log('👥 TEST 5: Verifica utenti con demos: true');
    // Verifica se esiste fcm_tokens (deve essere un array)
    const fcmColumnCheck = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND (column_name LIKE '%fcm%' OR column_name LIKE '%token%')
      AND data_type = 'ARRAY'
    `);
    
    const fcmColumn = fcmColumnCheck.rows.length > 0 ? fcmColumnCheck.rows[0].column_name : null;
    console.log(`Colonna FCM trovata: ${fcmColumn || 'Nessuna'}`);
    
    if (fcmColumn) {
      const utentiResult = await client.query(`
        SELECT id, email, nome, cognome, ${fcmColumn}, notifiche_preferenze
        FROM users 
        WHERE (status = 'active' OR status IS NULL)
          AND notifiche_preferenze->>'demos' = 'true'
          AND ${fcmColumn} IS NOT NULL 
          AND array_length(${fcmColumn}, 1) > 0
        LIMIT 5
      `);
      
      console.log(`✅ Trovati ${utentiResult.rows.length} utenti con demos: true e FCM tokens`);
      utentiResult.rows.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.email || u.id}`);
        console.log(`      FCM tokens: ${u[fcmColumn]?.length || 0}`);
        console.log(`      Preferenze: ${JSON.stringify(u.notifiche_preferenze)}`);
      });
    } else {
      console.log('⚠️ Colonna FCM (array) non trovata nella tabella users');
      // Prova senza filtro FCM
      const utentiResult = await client.query(`
        SELECT id, email, nome, cognome, notifiche_preferenze
        FROM users 
        WHERE (status = 'active' OR status IS NULL)
          AND notifiche_preferenze->>'demos' = 'true'
        LIMIT 5
      `);
      console.log(`✅ Trovati ${utentiResult.rows.length} utenti con demos: true`);
    }
    console.log('');

    // TEST 6: Verifica che l'utente di test abbia demos: true
    console.log('🔍 TEST 6: Verifica utente di test');
    const fcmCol = fcmColumn || 'fcm_tokens';
    const userTestQuery = fcmColumn ? `
      SELECT id, email, notifiche_preferenze->>'demos' as demos, 
             ${fcmCol}, array_length(${fcmCol}, 1) as fcm_count
      FROM users 
      WHERE id = $1
    ` : `
      SELECT id, email, notifiche_preferenze->>'demos' as demos
      FROM users 
      WHERE id = $1
    `;
    
    const userTestResult = await client.query(userTestQuery, [testUserId]);
    
    if (userTestResult.rows.length > 0) {
      const user = userTestResult.rows[0];
      console.log(`✅ Utente trovato: ${user.email || user.id}`);
      console.log(`   demos: ${user.demos}`);
      if (fcmColumn) {
        console.log(`   FCM tokens: ${user.fcm_count || 0}`);
      }
      
      if (user.demos === 'true') {
        console.log('✅ Utente ha demos: true (riceverà push)');
      } else {
        console.log('⚠️ Utente NON ha demos: true (NON riceverà push)');
        console.log('   Per ricevere push, esegui:');
        console.log(`   UPDATE users SET notifiche_preferenze = jsonb_set(COALESCE(notifiche_preferenze, '{}'::jsonb), '{demos}', 'true'::jsonb) WHERE id = '${testUserId}'`);
      }
      
      if (fcmColumn && (user.fcm_count || 0) > 0) {
        console.log('✅ Utente ha FCM tokens (può ricevere push)');
      } else if (fcmColumn) {
        console.log('⚠️ Utente NON ha FCM tokens (NON può ricevere push)');
      }
    } else {
      console.log('❌ Utente di test non trovato');
    }
    console.log('');

    // TEST 7: Simula query badge
    console.log('🔔 TEST 7: Simula query badge');
    const badgeQuery = isUUIDArray ? `
      SELECT
        c.*,
        CASE 
          WHEN c.read_by IS NULL OR array_length(c.read_by, 1) IS NULL THEN false
          WHEN $1::uuid = ANY(c.read_by) THEN true
          ELSE false
        END as is_read
      FROM comunicazioni c
      WHERE c.tipo IN ('demos_notification', 'new_opinions')
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
      WHERE c.tipo IN ('demos_notification', 'new_opinions')
      ORDER BY c.data_creazione DESC
      LIMIT 10
    `;
    
    const badgeResult = await client.query(badgeQuery, [testUserId]);
    
    const badgeCount = badgeResult.rows.filter(r => !r.is_read).length;
    console.log(`✅ Badge count: ${badgeCount} notifiche non lette`);
    
    if (badgeCount > 0) {
      console.log('✅ Il badge dovrebbe mostrare il pallino rosso');
    } else {
      console.log('⚠️ Il badge NON mostrerà il pallino rosso');
    }
    console.log('');

    // PULIZIA: Rimuovi comunicazione di test
    console.log('🧹 PULIZIA: Rimozione comunicazione di test');
    await client.query('DELETE FROM comunicazioni WHERE id = $1', [comunicazioneId]);
    console.log(`✅ Comunicazione di test rimossa\n`);

    console.log('✅ TUTTI I TEST COMPLETATI');
    
  } catch (error) {
    console.error('❌ ERRORE NEI TEST:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

testNotificheDemos()
  .then(() => {
    console.log('\n🎉 Test completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test fallito:', error);
    process.exit(1);
  });

