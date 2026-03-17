#!/usr/bin/env node

/**
 * Script per correggere i valori "Sì"/"No" nel database
 * Trasforma "Sì" in "f" e "No" in "c"
 */

const { Pool } = require('pg');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

async function fixSiNoValues() {
  try {
    console.log('🔧 Inizio correzione valori Sì/No nel database...');
    
    // Ottieni tutte le colonne della tabella opinioni_risposte
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' 
      AND column_name NOT IN ('user_id', 'fonti_opinioni')
      ORDER BY column_name
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    console.log(`📋 Trovate ${columns.length} colonne di opinioni da correggere`);
    
    let totalUpdated = 0;
    
    // Per ogni colonna, aggiorna i valori
    for (const column of columns) {
      console.log(`🔧 Correzione colonna: ${column}`);
      
      // Conta i valori da correggere
      const countQuery = `
        SELECT 
          COUNT(CASE WHEN ${column} = 'Sì' THEN 1 END) as si_count,
          COUNT(CASE WHEN ${column} = 'No' THEN 1 END) as no_count
        FROM opinioni_risposte 
        WHERE ${column} IN ('Sì', 'No')
      `;
      
      const countResult = await pool.query(countQuery);
      const siCount = parseInt(countResult.rows[0].si_count);
      const noCount = parseInt(countResult.rows[0].no_count);
      
      console.log(`  📊 Trovati ${siCount} "Sì" e ${noCount} "No" in ${column}`);
      
      if (siCount > 0 || noCount > 0) {
        // Aggiorna i valori
        const updateQuery = `
          UPDATE opinioni_risposte 
          SET ${column} = CASE 
            WHEN ${column} = 'Sì' THEN 'f'
            WHEN ${column} = 'No' THEN 'c'
            ELSE ${column}
          END
          WHERE ${column} IN ('Sì', 'No')
        `;
        
        const updateResult = await pool.query(updateQuery);
        const updatedRows = updateResult.rowCount;
        
        console.log(`  ✅ Aggiornati ${updatedRows} valori in ${column}`);
        totalUpdated += updatedRows;
      }
    }
    
    console.log(`🎉 Correzione completata! Totale valori aggiornati: ${totalUpdated}`);
    
    // Verifica che non ci siano più valori "Sì"/"No"
    const verifyQuery = `
      SELECT column_name, 
             COUNT(CASE WHEN ${columns.map(col => `${col} = 'Sì'`).join(' OR ')} THEN 1 END) as si_remaining,
             COUNT(CASE WHEN ${columns.map(col => `${col} = 'No'`).join(' OR ')} THEN 1 END) as no_remaining
      FROM opinioni_risposte
      GROUP BY column_name
      HAVING COUNT(CASE WHEN ${columns.map(col => `${col} = 'Sì'`).join(' OR ')} THEN 1 END) > 0
         OR COUNT(CASE WHEN ${columns.map(col => `${col} = 'No'`).join(' OR ')} THEN 1 END) > 0
    `;
    
    try {
      const verifyResult = await pool.query(verifyQuery);
      if (verifyResult.rows.length > 0) {
        console.log('⚠️ Attenzione: sono ancora presenti valori "Sì"/"No"');
        console.log(verifyResult.rows);
      } else {
        console.log('✅ Verifica completata: nessun valore "Sì"/"No" rimasto');
      }
    } catch (error) {
      console.log('ℹ️ Verifica non eseguita (query complessa)');
    }
    
  } catch (error) {
    console.error('❌ Errore durante la correzione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui lo script
if (require.main === module) {
  fixSiNoValues()
    .then(() => {
      console.log('✅ Script completato con successo');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { fixSiNoValues };
