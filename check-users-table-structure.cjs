const { Pool } = require('pg');
require('dotenv').config();

// Configurazione Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/database'
});

async function checkUsersTableStructure() {
  console.log('🔍 Verificando struttura tabella users...');
  
  try {
    // Verifica la struttura della tabella users
    const { rows: columns } = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log(`\n📋 Struttura tabella 'users' (${columns.length} colonne):`);
    console.log('─'.repeat(80));
    
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultValue = col.column_default ? `DEFAULT ${col.column_default}` : '';
      console.log(`${col.column_name.padEnd(25)} | ${col.data_type.padEnd(15)} | ${nullable.padEnd(8)} | ${defaultValue}`);
    });
    
    // Verifica specificamente le colonne di candidatura ed elezione
    const candidatureColumns = [
      'candidato_attivo', 'status_candidatura', 'grado_candidatura',
      'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 
      'comune_candidatura', 'data_candidatura', 'note_candidatura'
    ];
    
    const elezioniColumns = [
      'grado_elezione', 'paese_elezione', 'regione_elezione', 
      'provincia_elezione', 'comune_elezione'
    ];
    
    const allRequiredColumns = [...candidatureColumns, ...elezioniColumns];
    const existingColumns = columns.map(col => col.column_name);
    
    console.log('\n🎯 Verifica colonne candidatura ed elezione:');
    console.log('─'.repeat(80));
    
    let missingColumns = [];
    let existingRequiredColumns = [];
    
    allRequiredColumns.forEach(col => {
      if (existingColumns.includes(col)) {
        existingRequiredColumns.push(col);
        console.log(`✅ ${col.padEnd(25)} | Presente`);
      } else {
        missingColumns.push(col);
        console.log(`❌ ${col.padEnd(25)} | MANCANTE`);
      }
    });
    
    console.log('\n📊 Riepilogo:');
    console.log(`   ✅ Colonne presenti: ${existingRequiredColumns.length}/${allRequiredColumns.length}`);
    console.log(`   ❌ Colonne mancanti: ${missingColumns.length}/${allRequiredColumns.length}`);
    
    if (missingColumns.length > 0) {
      console.log('\n⚠️ Colonne mancanti:');
      missingColumns.forEach(col => console.log(`   - ${col}`));
      
      console.log('\n🔧 Per aggiungere le colonne mancanti, esegui:');
      console.log('   npm run add-candidature-elezioni-columns');
    }
    
    // Verifica se ci sono dati nelle colonne esistenti
    if (existingRequiredColumns.length > 0) {
      console.log('\n📊 Verifica dati nelle colonne esistenti:');
      console.log('─'.repeat(80));
      
      for (const col of existingRequiredColumns) {
        try {
          const { rows: result } = await pool.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(${col}) as not_null,
              COUNT(*) - COUNT(${col}) as null_count
            FROM users
          `);
          
          const stats = result[0];
          const percentage = stats.total > 0 ? ((stats.not_null / stats.total) * 100).toFixed(1) : 0;
          
          console.log(`${col.padEnd(25)} | ${stats.not_null.toString().padStart(5)}/${stats.total.toString().padStart(5)} (${percentage}%)`);
        } catch (error) {
          console.log(`${col.padEnd(25)} | Errore nella verifica`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Esegui la verifica
checkUsersTableStructure();
