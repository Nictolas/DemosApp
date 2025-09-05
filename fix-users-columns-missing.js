const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixUsersColumns() {
  try {
    console.log('🔧 Aggiungo colonne mancanti alla tabella users...');
    
    const client = await pool.connect();
    
    // Colonne mancanti da aggiungere
    const missingColumns = [
      'carne_coltivata',
      'case_chiuse', 
      'eutanasia',
      'legalizzazione_canapa',
      'matrimonio_gay',
      'nato',
      'omobitransfobia',
      'salario_minimo',
      'sperimentazione_animale'
    ];
    
    for (const column of missingColumns) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column} TEXT DEFAULT NULL`);
        console.log(`✅ Aggiunta colonna: ${column}`);
      } catch (error) {
        console.log(`⚠️ Colonna ${column} già esiste o errore: ${error.message}`);
      }
    }
    
    // Verifica finale
    console.log('\n📊 VERIFICA FINALE:');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('carne_coltivata', 'case_chiuse', 'eutanasia', 'legalizzazione_canapa', 'matrimonio_gay', 'nato', 'omobitransfobia', 'salario_minimo', 'sperimentazione_animale')
      ORDER BY column_name
    `);
    
    console.log('Colonne aggiunte:', result.rows.length);
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    client.release();
    console.log('\n✅ Operazione completata!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

fixUsersColumns();
