const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixOpinioniDomandeColumns() {
  console.log('🔧 Correzione colonne tabella opinioni_domande...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // 1. Controlla la struttura attuale della tabella
    console.log('📋 Controllo struttura attuale...');
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_domande'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await client.query(structureQuery);
    console.log('📋 Colonne attuali:');
    structureResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // 2. Rinomina la colonna "approfondimenti" in "approfondimento"
    console.log('🔄 Rinomino colonna "approfondimenti" -> "approfondimento"...');
    try {
      await client.query(`
        ALTER TABLE opinioni_domande 
        RENAME COLUMN approfondimenti TO approfondimento
      `);
      console.log('✅ Colonna rinominata con successo');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️ Colonna "approfondimenti" non esiste, controllo se "approfondimento" esiste già...');
        const checkApprofondimento = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'opinioni_domande' AND column_name = 'approfondimento'
        `);
        if (checkApprofondimento.rows.length > 0) {
          console.log('✅ Colonna "approfondimento" esiste già');
        } else {
          console.log('❌ Nessuna delle due colonne esiste');
        }
      } else {
        throw error;
      }
    }
    
    // 3. Cancella la colonna "informazioni" se esiste
    console.log('🗑️ Cancello colonna "informazioni"...');
    try {
      await client.query(`
        ALTER TABLE opinioni_domande 
        DROP COLUMN informazioni
      `);
      console.log('✅ Colonna "informazioni" cancellata');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️ Colonna "informazioni" non esiste');
      } else {
        throw error;
      }
    }
    
    // 4. Verifica la struttura finale
    console.log('📋 Verifica struttura finale...');
    const finalStructure = await client.query(structureQuery);
    console.log('📋 Colonne finali:');
    finalStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n✅ Correzione colonne completata!');
    
  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('📋 Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixOpinioniDomandeColumns();
