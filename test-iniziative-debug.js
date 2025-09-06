const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testIniziativeTable() {
  try {
    console.log('🔍 Test connessione database...');
    
    // Test 1: Verifica se la tabella esiste
    console.log('\n1. Verifica esistenza tabella iniziative_popolari...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'iniziative_popolari'
      );
    `);
    console.log('Tabella iniziative_popolari esiste:', tableCheck.rows[0].exists);
    
    // Test 2: Verifica struttura tabella
    console.log('\n2. Struttura tabella iniziative_popolari...');
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'iniziative_popolari'
      ORDER BY ordinal_position;
    `);
    console.log('Colonne trovate:', structureCheck.rows.length);
    structureCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test 3: Conta record
    console.log('\n3. Conteggio record...');
    const countResult = await pool.query('SELECT COUNT(*) FROM iniziative_popolari');
    console.log('Record totali:', countResult.rows[0].count);
    
    // Test 4: Verifica tabella voti
    console.log('\n4. Verifica tabella voti_iniziative_popolari...');
    const votiTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'voti_iniziative_popolari'
      );
    `);
    console.log('Tabella voti_iniziative_popolari esiste:', votiTableCheck.rows[0].exists);
    
    // Test 5: Prova query semplificata
    console.log('\n5. Test query semplificata...');
    const simpleQuery = await pool.query('SELECT id, nome FROM iniziative_popolari LIMIT 5');
    console.log('Query semplificata riuscita:', simpleQuery.rows.length, 'record');
    simpleQuery.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.nome}`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testIniziativeTable();
