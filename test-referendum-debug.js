const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testReferendumTables() {
  try {
    console.log('🔍 Test tabelle referendum...');
    
    // Test 1: Verifica se le tabelle esistono
    console.log('\n1. Verifica esistenza tabelle...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('referendum_abrogativi', 'voti_referendum_abrogativi')
      ORDER BY table_name;
    `);
    console.log('Tabelle trovate:', tableCheck.rows.map(r => r.table_name));
    
    // Test 2: Verifica struttura tabella referendum_abrogativi
    console.log('\n2. Struttura tabella referendum_abrogativi...');
    const referendumStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'referendum_abrogativi'
      ORDER BY ordinal_position;
    `);
    console.log('Colonne referendum_abrogativi:');
    referendumStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test 3: Verifica struttura tabella voti_referendum_abrogativi
    console.log('\n3. Struttura tabella voti_referendum_abrogativi...');
    const votiStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'voti_referendum_abrogativi'
      ORDER BY ordinal_position;
    `);
    console.log('Colonne voti_referendum_abrogativi:');
    votiStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test 4: Conta record
    console.log('\n4. Conteggio record...');
    const referendumCount = await pool.query('SELECT COUNT(*) FROM referendum_abrogativi');
    const votiCount = await pool.query('SELECT COUNT(*) FROM voti_referendum_abrogativi');
    console.log('Referendum abrogativi:', referendumCount.rows[0].count);
    console.log('Voti referendum:', votiCount.rows[0].count);
    
    // Test 5: Query principale
    console.log('\n5. Test query principale...');
    const referendumQuery = `
      SELECT DISTINCT r.id, r.nome, r.data_inizio, r.data_fine, r.status, r.quorum, r.firestore_id_backup
      FROM referendum_abrogativi r
      WHERE r.status = 'accepted' OR r.status = 'pending'
      ORDER BY r.nome
    `;
    const referendumResult = await pool.query(referendumQuery);
    console.log('Query referendum riuscita:', referendumResult.rows.length, 'record');
    referendumResult.rows.forEach(row => {
      console.log(`  - ${row.nome} (${row.status})`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testReferendumTables();
