const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function cleanupOpinioniTable() {
  console.log('🧹 Pulizia tabella opinioni - Rimuovo colonna grado_opinione...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // 1. Verifica la struttura attuale
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await client.query(structureQuery);
    console.log('📋 Struttura attuale tabella opinioni:');
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // 2. Rimuovi la colonna grado_opinione (vecchia)
    const dropColumnQuery = `
      ALTER TABLE opinioni 
      DROP COLUMN IF EXISTS grado_opinione
    `;
    
    await client.query(dropColumnQuery);
    console.log('✅ Colonna grado_opinione rimossa');
    
    // 3. Verifica che tutte le opinioni abbiano gradi_opinione corretti
    const verifyQuery = `
      SELECT 
        text,
        gradi_opinione,
        array_length(gradi_opinione, 1) as num_gradi
      FROM opinioni 
      ORDER BY text
    `;
    
    const verifyResult = await client.query(verifyQuery);
    console.log('\n📊 Stato finale opinioni:');
    verifyResult.rows.forEach(row => {
      console.log(`  "${row.text}" → [${row.gradi_opinione.join(', ')}] (${row.num_gradi} gradi)`);
    });
    
    // 4. Statistiche per grado
    const statsQuery = `
      SELECT 
        unnest(gradi_opinione) as grado,
        COUNT(*) as count
      FROM opinioni 
      GROUP BY unnest(gradi_opinione)
      ORDER BY grado
    `;
    
    const statsResult = await client.query(statsQuery);
    console.log('\n📊 Distribuzione opinioni per grado:');
    statsResult.rows.forEach(row => {
      console.log(`  ${row.grado}: ${row.count}`);
    });
    
    // 5. Verifica struttura finale
    const finalStructureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position
    `;
    
    const finalStructureResult = await client.query(finalStructureQuery);
    console.log('\n📋 Struttura finale tabella opinioni:');
    finalStructureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    client.release();
    console.log('\n✅ Pulizia completata con successo');
    
  } catch (error) {
    console.error('❌ Errore durante la pulizia:', error);
  } finally {
    await pool.end();
  }
}

cleanupOpinioniTable();
