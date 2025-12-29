require('dotenv').config();
const { Pool } = require('pg');

// Configurazione Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function addCandidatureElezioniColumns() {
  console.log('🔧 Aggiungendo colonne candidatura ed elezione...');
  
  try {
    // Verifica prima la struttura attuale
    const { rows: existingColumns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    const existingColumnNames = existingColumns.map(col => col.column_name);
    
    // Definizione delle colonne da aggiungere
    const columnsToAdd = [
      // Colonne candidatura
      { name: 'candidato_attivo', type: 'BOOLEAN', nullable: true },
      { name: 'status_candidatura', type: 'VARCHAR(50)', nullable: true },
      { name: 'grado_candidatura', type: 'VARCHAR(50)', nullable: true },
      { name: 'paese_candidatura', type: 'VARCHAR(100)', nullable: true },
      { name: 'regione_candidatura', type: 'VARCHAR(100)', nullable: true },
      { name: 'provincia_candidatura', type: 'VARCHAR(100)', nullable: true },
      { name: 'comune_candidatura', type: 'VARCHAR(100)', nullable: true },
      { name: 'data_candidatura', type: 'DATE', nullable: true },
      { name: 'note_candidatura', type: 'TEXT', nullable: true },
      
      // Colonne elezione
      { name: 'grado_elezione', type: 'VARCHAR(50)', nullable: true },
      { name: 'paese_elezione', type: 'VARCHAR(100)', nullable: true },
      { name: 'regione_elezione', type: 'VARCHAR(100)', nullable: true },
      { name: 'provincia_elezione', type: 'VARCHAR(100)', nullable: true },
      { name: 'comune_elezione', type: 'VARCHAR(100)', nullable: true }
    ];
    
    console.log(`📋 Verificando ${columnsToAdd.length} colonne...`);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const column of columnsToAdd) {
      if (existingColumnNames.includes(column.name)) {
        console.log(`⏭️  Colonna ${column.name} già esistente, saltata`);
        skippedCount++;
        continue;
      }
      
      try {
        const nullable = column.nullable ? 'NULL' : 'NOT NULL';
        const alterQuery = `
          ALTER TABLE users 
          ADD COLUMN ${column.name} ${column.type} ${nullable}
        `;
        
        await pool.query(alterQuery);
        console.log(`✅ Aggiunta colonna: ${column.name} (${column.type})`);
        addedCount++;
        
      } catch (error) {
        console.error(`❌ Errore nell'aggiunta della colonna ${column.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 Operazione completata!');
    console.log(`📊 Riepilogo:`);
    console.log(`   ✅ Colonne aggiunte: ${addedCount}`);
    console.log(`   ⏭️  Colonne saltate: ${skippedCount}`);
    
    if (addedCount > 0) {
      console.log('\n🔍 Per verificare la nuova struttura, esegui:');
      console.log('   node check-users-table-structure.cjs');
      
      console.log('\n🚀 Per migrare i dati da Firestore, esegui:');
      console.log('   node migrate-candidature-elezioni.cjs');
    }
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta delle colonne:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Esegui l'aggiunta delle colonne
addCandidatureElezioniColumns();
