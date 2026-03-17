require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkRequiredColumns() {
  try {
    console.log('🔍 Verifica colonne obbligatorie per utenti P (C e S)...\n');
    
    // Ottieni struttura completa della tabella users
    const structure = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Tutte le colonne della tabella users:');
    console.log('='.repeat(80));
    
    const requiredColumns = [];
    const optionalColumns = [];
    
    structure.rows.forEach(col => {
      const isRequired = col.is_nullable === 'NO';
      const defaultVal = col.column_default ? ` (default: ${col.column_default})` : '';
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      
      const info = `  - ${col.column_name}: ${col.data_type}${length} ${isRequired ? 'NOT NULL' : 'NULL'}${defaultVal}`;
      
      if (isRequired) {
        requiredColumns.push(col.column_name);
        console.log('🔴' + info);
      } else {
        optionalColumns.push(col.column_name);
        console.log('⚪' + info);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Riepilogo:`);
    console.log(`  🔴 Colonne obbligatorie (NOT NULL): ${requiredColumns.length}`);
    console.log(`  ⚪ Colonne opzionali (NULL): ${optionalColumns.length}`);
    
    console.log(`\n🔴 Colonne obbligatorie (NOT NULL):`);
    requiredColumns.forEach(col => {
      const colInfo = structure.rows.find(r => r.column_name === col);
      console.log(`  - ${col} (${colInfo.data_type}${colInfo.character_maximum_length ? `(${colInfo.character_maximum_length})` : ''})`);
    });
    
    // Verifica colonne specifiche usate per politici
    console.log(`\n📌 Colonne specifiche per politici (ruolo='P', grado_elezione='C' o 'S'):`);
    const politicoColumns = ['id', 'nome', 'cognome', 'data_nascita', 'ruolo', 'grado_elezione', 'status'];
    
    politicoColumns.forEach(colName => {
      const col = structure.rows.find(r => r.column_name === colName);
      if (col) {
        const isRequired = col.is_nullable === 'NO';
        console.log(`  ${isRequired ? '🔴' : '⚪'} ${colName}: ${isRequired ? 'OBBLIGATORIA' : 'OPZIONALE'} (${col.data_type})`);
      } else {
        console.log(`  ⚠️  ${colName}: COLONNA NON TROVATA`);
      }
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkRequiredColumns();
