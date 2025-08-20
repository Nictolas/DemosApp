const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAndFixOpinioniGrado() {
  try {
    console.log('🔍 Controllo valori grado_opinione nella tabella opinioni...');
    
    // 1. Controlla tutti i valori attuali
    const checkResult = await pool.query('SELECT id, text, grado_opinione FROM opinioni ORDER BY id');
    console.log('\n📋 Valori attuali:');
    checkResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Text: ${row.text}, Grado: ${row.grado_opinione || 'NULL'}`);
    });
    
    // 2. Conta opinioni per grado
    const countResult = await pool.query(`
      SELECT 
        grado_opinione, 
        COUNT(*) as count 
      FROM opinioni 
      GROUP BY grado_opinione 
      ORDER BY grado_opinione
    `);
    
    console.log('\n📊 Conteggio per grado:');
    countResult.rows.forEach(row => {
      console.log(`  ${row.grado_opinione || 'NULL'}: ${row.count}`);
    });
    
    // 3. Trova opinioni con grado_opinione NULL o vuoto
    const nullResult = await pool.query(`
      SELECT id, text 
      FROM opinioni 
      WHERE grado_opinione IS NULL OR grado_opinione = ''
    `);
    
    if (nullResult.rows.length > 0) {
      console.log(`\n⚠️  Trovate ${nullResult.rows.length} opinioni con grado_opinione NULL o vuoto:`);
      nullResult.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Text: ${row.text}`);
      });
      
      // 4. Imposta un grado di default per le opinioni NULL
      console.log('\n🔧 Imposto grado_opinione = "Nazionale" per le opinioni NULL...');
      const updateResult = await pool.query(`
        UPDATE opinioni 
        SET grado_opinione = 'Nazionale' 
        WHERE grado_opinione IS NULL OR grado_opinione = ''
      `);
      
      console.log(`✅ Aggiornate ${updateResult.rowCount} opinioni`);
      
      // 5. Verifica finale
      const finalCheck = await pool.query('SELECT grado_opinione, COUNT(*) as count FROM opinioni GROUP BY grado_opinione ORDER BY grado_opinione');
      console.log('\n📊 Conteggio finale per grado:');
      finalCheck.rows.forEach(row => {
        console.log(`  ${row.grado_opinione}: ${row.count}`);
      });
    } else {
      console.log('\n✅ Nessuna opinione con grado_opinione NULL o vuoto trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

checkAndFixOpinioniGrado();
