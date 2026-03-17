const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Lista dei ministeri
const ministeri = [
  'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
  'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
  'cultura', 'sport'
];

async function verifyMinisteriTables() {
  try {
    console.log('🔍 Verifica tabelle ministeri...\n');
    
    let allTablesExist = true;
    let totalRecords = 0;
    
    for (const ministero of ministeri) {
      const tableName = `voti_ministro_${ministero}`;
      
      try {
        // Verifica che la tabella esista
        const tableExistsQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `;
        
        const tableExistsResult = await pool.query(tableExistsQuery, [tableName]);
        const tableExists = tableExistsResult.rows[0].exists;
        
        if (tableExists) {
          // Conta i record nella tabella
          const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
          const countResult = await pool.query(countQuery);
          const count = parseInt(countResult.rows[0].count);
          totalRecords += count;
          
          console.log(`✅ ${tableName}: ${count} record`);
        } else {
          console.log(`❌ ${tableName}: TABELLA NON ESISTE`);
          allTablesExist = false;
        }
        
      } catch (error) {
        console.log(`❌ ${tableName}: ERRORE - ${error.message}`);
        allTablesExist = false;
      }
    }
    
    console.log(`\n📊 Totale record in tutte le tabelle: ${totalRecords}`);
    
    // Verifica anche la tabella originale
    try {
      const originalCountQuery = 'SELECT COUNT(*) as count FROM voti_ministri';
      const originalCountResult = await pool.query(originalCountQuery);
      const originalCount = parseInt(originalCountResult.rows[0].count);
      
      console.log(`📊 Record nella tabella originale (voti_ministri): ${originalCount}`);
      
      if (originalCount === totalRecords) {
        console.log('✅ Verifica completata: tutti i record sono stati migrati correttamente!');
      } else {
        console.log('⚠️  Attenzione: il numero di record non corrisponde');
      }
      
    } catch (error) {
      console.log(`❌ Errore nel verificare la tabella originale: ${error.message}`);
    }
    
    if (allTablesExist) {
      console.log('\n🎉 TUTTE LE TABELLE SONO STATE CREATE CORRETTAMENTE! ✅');
    } else {
      console.log('\n⚠️  ALCUNE TABELLE NON SONO STATE CREATE CORRETTAMENTE!');
    }
    
  } catch (error) {
    console.error('❌ Errore nella verifica:', error.message);
  } finally {
    await pool.end();
  }
}

verifyMinisteriTables();
