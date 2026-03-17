const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function debugOpinioni500() {
  console.log('🔍 DEBUG - Verifico perché le opinioni restituiscono errore 500...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // 1. Verifica struttura tabella opinioni
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await client.query(structureQuery);
    console.log('📋 Struttura tabella opinioni:');
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // 2. Conta righe totali
    const countQuery = 'SELECT COUNT(*) as total FROM opinioni';
    const countResult = await client.query(countQuery);
    console.log(`📊 Righe totali: ${countResult.rows[0].total}`);
    
    // 3. Testa la query che causa l'errore 500
    console.log('\n🧪 Test query per grado "Nazionale":');
    const testQuery = `
      SELECT o.*, o.gradi_opinione as categoria_nome
      FROM opinioni o
      WHERE 'Nazionale' = ANY(o.gradi_opinione)
      ORDER BY o.text
    `;
    
    console.log('📝 Query:', testQuery);
    
    try {
      const testResult = await client.query(testQuery);
      console.log(`✅ Query eseguita con successo: ${testResult.rows.length} risultati`);
      if (testResult.rows.length > 0) {
        console.log('📋 Prime 3 opinioni:');
        testResult.rows.slice(0, 3).forEach(row => {
          console.log(`  - "${row.text}" → [${row.gradi_opinione.join(', ')}]`);
        });
      }
    } catch (error) {
      console.error('❌ Errore nella query:', error.message);
      console.error('📋 Stack trace:', error.stack);
    }
    
    // 4. Verifica se ci sono opinioni con gradi_opinione NULL
    const nullQuery = `
      SELECT COUNT(*) as null_count 
      FROM opinioni 
      WHERE gradi_opinione IS NULL
    `;
    
    const nullResult = await client.query(nullQuery);
    console.log(`⚠️ Opinion con gradi_opinione NULL: ${nullResult.rows[0].null_count}`);
    
    if (parseInt(nullResult.rows[0].null_count) > 0) {
      console.log('🔍 Esempi opinion con gradi_opinione NULL:');
      const examplesQuery = `
        SELECT text, gradi_opinione 
        FROM opinioni 
        WHERE gradi_opinione IS NULL 
        LIMIT 5
      `;
      const examplesResult = await client.query(examplesQuery);
      examplesResult.rows.forEach(row => {
        console.log(`  - "${row.text}" → ${row.gradi_opinione}`);
      });
    }
    
    // 5. Verifica distribuzione gradi
    const degreesQuery = `
      SELECT 
        unnest(gradi_opinione) as grado,
        COUNT(*) as count 
      FROM opinioni 
      WHERE gradi_opinione IS NOT NULL
      GROUP BY unnest(gradi_opinione)
      ORDER BY grado
    `;
    
    try {
      const degreesResult = await client.query(degreesQuery);
      console.log('\n📊 Distribuzione gradi (escludendo NULL):');
      degreesResult.rows.forEach(row => {
        console.log(`  ${row.grado}: ${row.count}`);
      });
    } catch (error) {
      console.error('❌ Errore nella query gradi:', error.message);
    }
    
    client.release();
    console.log('\n✅ Debug completato');
    
  } catch (error) {
    console.error('❌ Errore durante il debug:', error);
  } finally {
    await pool.end();
  }
}

debugOpinioni500();
