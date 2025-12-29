const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkVotiICEStructure() {
  try {
    console.log('🔍 Verifica struttura tabella voti_ice...');
    
    // Verifica la struttura della tabella voti_ice
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'voti_ice'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    console.log(`📋 Struttura tabella voti_ice:`);
    structureResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Conta i record
    const countQuery = 'SELECT COUNT(*) as total FROM voti_ice';
    const countResult = await pool.query(countQuery);
    console.log(`\n📊 Record totali in voti_ice: ${countResult.rows[0].total}`);
    
    // Mostra alcuni record
    if (parseInt(countResult.rows[0].total) > 0) {
      const sampleQuery = 'SELECT * FROM voti_ice LIMIT 3';
      const sampleResult = await pool.query(sampleQuery);
      console.log('\n📋 Record di esempio:');
      sampleResult.rows.forEach((record, index) => {
        console.log(`  ${index + 1}. ${JSON.stringify(record, null, 2)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkVotiICEStructure();
