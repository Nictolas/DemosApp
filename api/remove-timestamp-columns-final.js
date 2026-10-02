const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function removeTimestampColumns() {
  try {
    console.log('🗑️  Rimozione campi timestamp dalla tabella voti_amnistia...\n');

    // 1. Backup della struttura attuale
    console.log('1. Backup struttura attuale...');
    const backupQuery = `
      CREATE TABLE IF NOT EXISTS voti_amnistia_backup AS 
      SELECT * FROM voti_amnistia;
    `;
    await pool.query(backupQuery);
    console.log('✅ Backup creato: voti_amnistia_backup');

    // 2. Rimuovi i campi timestamp
    console.log('\n2. Rimozione campo timestamp...');
    await pool.query('ALTER TABLE voti_amnistia DROP COLUMN IF EXISTS timestamp;');
    console.log('✅ Campo timestamp rimosso');

    console.log('3. Rimozione campo created_at...');
    await pool.query('ALTER TABLE voti_amnistia DROP COLUMN IF EXISTS created_at;');
    console.log('✅ Campo created_at rimosso');

    console.log('4. Rimozione campo updated_at...');
    await pool.query('ALTER TABLE voti_amnistia DROP COLUMN IF EXISTS updated_at;');
    console.log('✅ Campo updated_at rimosso');

    // 3. Ricrea l'indice univoco (userid, legge)
    console.log('\n5. Ricreazione indice univoco...');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS voti_amnistia_userid_legge_key ON voti_amnistia (userid, legge);');
    console.log('✅ Indice univoco ricreato');

    // 4. Verifica struttura finale
    console.log('\n6. Verifica struttura finale...');
    const finalStructureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'voti_amnistia'
      ORDER BY ordinal_position;
    `;
    
    const finalStructureResult = await pool.query(finalStructureQuery);
    console.log('Struttura finale tabella voti_amnistia:');
    console.table(finalStructureResult.rows);

    // 5. Verifica indici
    console.log('\n7. Verifica indici...');
    const indexesQuery = `
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'voti_amnistia';
    `;
    
    const indexesResult = await pool.query(indexesQuery);
    console.log('Indici attuali:');
    console.table(indexesResult.rows);

    // 6. Verifica che i dati siano ancora presenti
    console.log('\n8. Verifica integrità dati...');
    const countQuery = 'SELECT COUNT(*) as total_voti FROM voti_amnistia;';
    const countResult = await pool.query(countQuery);
    console.log(`✅ Totale voti rimanenti: ${countResult.rows[0].total_voti}`);

    // 7. Test inserimento usando un UUID valido esistente
    console.log('\n9. Test inserimento...');
    
    // Prima trova un UUID valido dalla tabella users
    const validUserQuery = 'SELECT id FROM users LIMIT 1;';
    const validUserResult = await pool.query(validUserQuery);
    
    if (validUserResult.rows.length > 0) {
      const validUserId = validUserResult.rows[0].id;
      
      const testInsertQuery = `
        INSERT INTO voti_amnistia (userid, firestore_userid, legge) 
        VALUES ($1, 'test_user', 'TEST_LEGGE')
        ON CONFLICT (userid, legge) DO NOTHING;
      `;
      await pool.query(testInsertQuery, [validUserId]);
      console.log('✅ Test inserimento completato');

      // Rimuovi il test
      await pool.query("DELETE FROM voti_amnistia WHERE legge = 'TEST_LEGGE';");
      console.log('✅ Dati di test rimossi');
    } else {
      console.log('⚠️  Nessun utente trovato per il test, saltando il test di inserimento');
    }

    console.log('\n🎉 Rimozione completata con successo!');
    console.log('📋 Campi rimossi: timestamp, created_at, updated_at');
    console.log('🔒 Indice univoco (userid, legge) ricreato');
    console.log('💾 Backup salvato in: voti_amnistia_backup');

  } catch (error) {
    console.error('❌ Errore durante la rimozione:', error);
    
    // In caso di errore, ripristina dalla backup
    console.log('\n🔄 Tentativo di ripristino dal backup...');
    try {
      await pool.query('DROP TABLE IF EXISTS voti_amnistia;');
      await pool.query('ALTER TABLE voti_amnistia_backup RENAME TO voti_amnistia;');
      console.log('✅ Ripristino completato');
    } catch (restoreError) {
      console.error('❌ Errore durante il ripristino:', restoreError);
    }
  } finally {
    await pool.end();
  }
}

removeTimestampColumns();
