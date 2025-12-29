const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function modifyICETable() {
  try {
    console.log('🔧 Modifica tabella ICE...');
    
    // 1. Verifica struttura attuale
    console.log('\n📋 Struttura attuale tabella ice:');
    const currentStructureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ice' 
      ORDER BY ordinal_position
    `;
    
    const currentStructure = await pool.query(currentStructureQuery);
    currentStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 2. Colonne da mantenere
    const columnsToKeep = [
      'id',
      'dataFine', 
      'dataInizio',
      'data_creazione',
      'descrizione',
      'nome',
      'quorum',
      'sitoWeb',
      'votiIces'
    ];
    
    // 3. Colonne da rimuovere
    const columnsToRemove = currentStructure.rows
      .map(col => col.column_name)
      .filter(col => !columnsToKeep.includes(col));
    
    console.log('\n🗑️ Colonne da rimuovere:', columnsToRemove);
    
    if (columnsToRemove.length === 0) {
      console.log('✅ Nessuna colonna da rimuovere');
    } else {
      // 4. Rimuovi le colonne non necessarie
      for (const column of columnsToRemove) {
        console.log(`\n❌ Rimozione colonna: ${column}`);
        try {
          await pool.query(`ALTER TABLE ice DROP COLUMN IF EXISTS ${column}`);
          console.log(`✅ Colonna ${column} rimossa`);
        } catch (error) {
          console.log(`⚠️ Errore nella rimozione di ${column}:`, error.message);
        }
      }
    }
    
    // 5. Verifica se esistono le colonne necessarie
    console.log('\n🔍 Verifica colonne necessarie...');
    const neededColumns = [
      { name: 'quorum', type: 'VARCHAR(20)', default: "'pending'" },
      { name: 'votiIces', type: 'INTEGER', default: '0' },
      { name: 'dataInizio', type: 'DATE', default: 'NULL' },
      { name: 'dataFine', type: 'DATE', default: 'NULL' },
      { name: 'sitoWeb', type: 'TEXT', default: 'NULL' }
    ];
    
    // 5.1. Cambia il tipo della colonna quorum se necessario
    const quorumTypeQuery = `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ice' AND column_name = 'quorum'
    `;
    const quorumTypeResult = await pool.query(quorumTypeQuery);
    
    if (quorumTypeResult.rows.length > 0 && quorumTypeResult.rows[0].data_type === 'integer') {
      console.log('🔄 Cambio tipo colonna quorum da integer a varchar...');
      try {
        await pool.query('ALTER TABLE ice ALTER COLUMN quorum TYPE VARCHAR(20)');
        console.log('✅ Tipo colonna quorum cambiato');
      } catch (error) {
        console.log('⚠️ Errore nel cambio tipo quorum:', error.message);
      }
    }
    
    for (const col of neededColumns) {
      const existsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'ice' AND column_name = $1
      `;
      
      const exists = await pool.query(existsQuery, [col.name]);
      
      if (exists.rows.length === 0) {
        console.log(`➕ Aggiunta colonna: ${col.name}`);
        try {
          if (col.default === 'NULL') {
            await pool.query(`ALTER TABLE ice ADD COLUMN ${col.name} ${col.type}`);
          } else {
            await pool.query(`ALTER TABLE ice ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
          }
          console.log(`✅ Colonna ${col.name} aggiunta`);
        } catch (error) {
          console.log(`⚠️ Errore nell'aggiunta di ${col.name}:`, error.message);
        }
      } else {
        console.log(`ℹ️ Colonna ${col.name} già esistente`);
      }
    }
    
    // 6. Verifica struttura finale
    console.log('\n📋 Struttura finale tabella ice:');
    const finalStructure = await pool.query(currentStructureQuery);
    finalStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 7. Aggiorna i dati esistenti
    console.log('\n🔄 Aggiornamento dati esistenti...');
    
    // Imposta quorum = 'pending' per tutte le ICE (valore di default)
    await pool.query(`
      UPDATE ice 
      SET quorum = 'pending' 
      WHERE quorum IS NULL
    `);
    
    // Imposta votiIces = 0 per tutte
    await pool.query(`
      UPDATE ice 
      SET votiIces = 0 
      WHERE votiIces IS NULL
    `);
    
    console.log('✅ Dati aggiornati');
    
    // 8. Verifica finale
    const countQuery = 'SELECT COUNT(*) as total FROM ice';
    const countResult = await pool.query(countQuery);
    console.log(`\n📊 Record totali nella tabella ice: ${countResult.rows[0].total}`);
    
    // Mostra alcuni record di esempio
    if (parseInt(countResult.rows[0].total) > 0) {
      const sampleQuery = 'SELECT id, nome, quorum, votiIces, dataInizio, dataFine, sitoWeb FROM ice LIMIT 3';
      const sampleResult = await pool.query(sampleQuery);
      console.log('\n📋 Record di esempio:');
      sampleResult.rows.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Nome: ${record.nome}, Quorum: ${record.quorum}, Voti: ${record.votiIces}`);
        console.log(`     Data inizio: ${record.dataInizio || 'N/A'}, Data fine: ${record.dataFine || 'N/A'}, Sito: ${record.sitoWeb || 'N/A'}`);
      });
    }
    
    console.log('\n✅ Modifica tabella ICE completata!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

modifyICETable();
