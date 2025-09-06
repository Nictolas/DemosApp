const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testFixedQuery() {
  try {
    console.log('🔍 Test query corretta...');
    
    // Test query di join corretta
    const joinTest = await pool.query(`
      SELECT 
        i.nome,
        COUNT(v.id) as voti
      FROM iniziative_popolari i
      LEFT JOIN voti_iniziative_popolari v ON i.id::text = v.iniziativa_id
      GROUP BY i.id, i.nome
      ORDER BY voti DESC, i.nome ASC
    `);
    console.log('✅ Query di join riuscita:', joinTest.rows.length, 'record');
    joinTest.rows.forEach(row => {
      console.log(`  - ${row.nome}: ${row.voti} voti`);
    });
    
    // Test query iniziative
    const iniziativeTest = await pool.query(
      'SELECT id, nome, sito_web as "sitoWeb", quorum FROM iniziative_popolari ORDER BY created_at DESC'
    );
    console.log('\n✅ Query iniziative riuscita:', iniziativeTest.rows.length, 'record');
    iniziativeTest.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.nome} (${row.sitoWeb || 'no sito'})`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testFixedQuery();
