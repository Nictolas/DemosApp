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

    // 3. Verifica struttura finale
    console.log('\n5. Verifica struttura finale...');
    const finalStructureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'voti_amnistia'
      ORDER BY ordinal_position;
    `;
    
    const finalStructureResult = await pool.query(finalStructureQuery);
    console.log('Struttura finale tabella voti_amnistia:');
    console.table(finalStructureResult.rows);

    // 4. Verifica che i dati siano ancora presenti
    console.log('\n6. Verifica integrità dati...');
    const countQuery = 'SELECT COUNT(*) as total_voti FROM voti_amnistia;';
    const countResult = await pool.query(countQuery);
    console.log(`✅ Totale voti rimanenti: ${countResult.rows[0].total_voti}`);

    // 5. Test inserimento per verificare che tutto funzioni
    console.log('\n7. Test inserimento...');
    const testInsertQuery = `
      INSERT INTO voti_amnistia (userid, firestore_userid, legge) 
      VALUES ('00000000-0000-0000-0000-000000000000', 'test_user', 'TEST_LEGGE')
      ON CONFLICT (userid, legge) DO NOTHING;
    `;
    await pool.query(testInsertQuery);
    console.log('✅ Test inserimento completato');

    // Rimuovi il test
    await pool.query("DELETE FROM voti_amnistia WHERE legge = 'TEST_LEGGE';");
    console.log('✅ Dati di test rimossi');

    console.log('\n🎉 Rimozione completata con successo!');
    console.log('📋 Campi rimossi: timestamp, created_at, updated_at');
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
