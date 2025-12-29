const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkTablesData() {
  try {
    console.log('🔍 Controllo dati nelle tabelle ministeri...\n');
    
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
      'cultura', 'sport'
    ];
    
    let totalRecords = 0;
    
    for (const ministero of ministeri) {
      const tableName = `voti_${ministero}`;
      
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
        const countResult = await pool.query(countQuery);
        const count = parseInt(countResult.rows[0].count);
        totalRecords += count;
        
        if (count > 0) {
          console.log(`✅ ${tableName}: ${count} record`);
          
          // Mostra i primi 3 record
          const sampleQuery = `SELECT nome_display, COUNT(*) as voti FROM ${tableName} GROUP BY nome_display ORDER BY voti DESC LIMIT 3`;
          const sampleResult = await pool.query(sampleQuery);
          
          console.log(`   Top 3:`);
          sampleResult.rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ${row.nome_display}: ${row.voti} voti`);
          });
        } else {
          console.log(`❌ ${tableName}: 0 record (VUOTA)`);
        }
        
      } catch (error) {
        console.log(`❌ ${tableName}: ERRORE - ${error.message}`);
      }
    }
    
    console.log(`\n📊 Totale record in tutte le tabelle: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('\n⚠️  PROBLEMA: Tutte le tabelle sono vuote!');
      console.log('🔧 Soluzione: Devi migrare i dati da voti_ministri alle nuove tabelle');
    } else {
      console.log('\n✅ Le tabelle contengono dati');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
  }
}

checkTablesData();
