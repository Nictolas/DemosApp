const { pool } = require('./api/middleware/auth');

async function updateIniziativePopolariTable() {
  try {
    console.log('🔍 Aggiorno la tabella iniziative_popolari per renderla uguale alla tabella ice...');
    
    // Prima verifico la struttura attuale
    console.log('\n📋 Struttura attuale della tabella iniziative_popolari:');
    const currentStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'iniziative_popolari' 
      ORDER BY ordinal_position
    `);
    
    if (currentStructure.rows.length > 0) {
      currentStructure.rows.forEach(row => {
        console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('La tabella iniziative_popolari non esiste ancora.');
    }
    
    console.log('\n🔧 Aggiungo le colonne mancanti per renderla uguale alla tabella ice...');
    
    // Aggiungo le colonne che dovrebbero essere presenti come nella tabella ice
    const columnsToAdd = [
      {
        name: 'descrizione',
        type: 'TEXT',
        comment: 'Descrizione dell\'iniziativa popolare'
      },
      {
        name: 'datainizio',
        type: 'DATE',
        comment: 'Data di inizio dell\'iniziativa popolare'
      },
      {
        name: 'datafine', 
        type: 'DATE',
        comment: 'Data di fine dell\'iniziativa popolare'
      },
      {
        name: 'sitoweb',
        type: 'TEXT',
        comment: 'Sito web dell\'iniziativa popolare'
      },
      {
        name: 'quorum',
        type: 'VARCHAR(50)',
        comment: 'Stato del quorum (proposta, pending, ok, no)'
      },
      {
        name: 'data_creazione',
        type: 'TIMESTAMP',
        comment: 'Data di creazione del record'
      },
      {
        name: 'votiices',
        type: 'INTEGER DEFAULT 0',
        comment: 'Numero di voti ICE (per compatibilità)'
      },
      {
        name: 'firme',
        type: 'INTEGER DEFAULT 0',
        comment: 'Numero di firme raccolte'
      },
      {
        name: 'esito',
        type: 'VARCHAR(100)',
        comment: 'Esito dell\'iniziativa popolare'
      }
    ];
    
    for (const column of columnsToAdd) {
      try {
        const alterQuery = `ALTER TABLE iniziative_popolari ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`;
        await pool.query(alterQuery);
        console.log(`✅ Aggiunta colonna: ${column.name}`);
      } catch (error) {
        console.log(`⚠️ Errore nell'aggiunta della colonna ${column.name}:`, error.message);
      }
    }
    
    console.log('\n✅ Aggiornamento completato!');
    console.log('\n📋 Nuova struttura della tabella iniziative_popolari:');
    
    const newStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'iniziative_popolari' 
      ORDER BY ordinal_position
    `);
    
    newStructure.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.log('❌ Errore nell\'aggiornamento della tabella:', error.message);
  }
  process.exit(0);
}

updateIniziativePopolariTable();
