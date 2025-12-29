const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkTableStructure() {
  try {
    console.log('🔍 Verifica struttura tabella referendum_abrogativi...\n');
    
    // Ottieni tutte le colonne della tabella
    const columns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'referendum_abrogativi'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colonne trovate in referendum_abrogativi:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // Cerca colonne che contengono "firestore"
    console.log('\n🔍 Colonne che contengono "firestore":');
    const firestoreColumns = columns.rows.filter(col => 
      col.column_name.toLowerCase().includes('firestore')
    );
    
    if (firestoreColumns.length === 0) {
      console.log('  ✅ Nessuna colonna firestore trovata');
    } else {
      firestoreColumns.forEach(col => {
        console.log(`  - ${col.column_name}`);
      });
    }
    
    // Cerca colonne che contengono "data" per vedere date alternative
    console.log('\n🔍 Colonne che contengono "data":');
    const dataColumns = columns.rows.filter(col => 
      col.column_name.toLowerCase().includes('data')
    );
    
    dataColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n🔍 Verifica struttura tabella iniziative_popolari...\n');
    
    // Stessa cosa per iniziative_popolari
    const iniziativeColumns = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'iniziative_popolari'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colonne trovate in iniziative_popolari:');
    iniziativeColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
  }
}

checkTableStructure();
