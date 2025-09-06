const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testVotiStructure() {
  try {
    console.log('🔍 Test struttura tabella voti_iniziative_popolari...');
    
    // Verifica struttura tabella voti
    const votiStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'voti_iniziative_popolari'
      ORDER BY ordinal_position;
    `);
    console.log('Colonne tabella voti_iniziative_popolari:');
    votiStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Conta record nella tabella voti
    const votiCount = await pool.query('SELECT COUNT(*) FROM voti_iniziative_popolari');
    console.log('\nRecord nella tabella voti:', votiCount.rows[0].count);
    
    // Test query di join
    console.log('\nTest query di join...');
    const joinTest = await pool.query(`
      SELECT 
        i.nome,
        COUNT(v.id) as voti
      FROM iniziative_popolari i
      LEFT JOIN voti_iniziative_popolari v ON i.id = v.iniziativaId
      GROUP BY i.id, i.nome
      ORDER BY voti DESC, i.nome ASC
    `);
    console.log('Query di join riuscita:', joinTest.rows.length, 'record');
    joinTest.rows.forEach(row => {
      console.log(`  - ${row.nome}: ${row.voti} voti`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testVotiStructure();
