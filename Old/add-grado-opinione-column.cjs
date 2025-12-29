const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addGradoOpinioneColumn() {
  console.log('🔧 Aggiunta campo grado_opinione alla tabella opinioni...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // 1. Verifica se la colonna esiste già
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      AND column_name = 'grado_opinione'
    `;
    
    const checkResult = await client.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️ La colonna grado_opinione esiste già');
      return;
    }
    
    // 2. Aggiungi la colonna grado_opinione
    const addColumnQuery = `
      ALTER TABLE opinioni 
      ADD COLUMN grado_opinione VARCHAR(50) DEFAULT 'Nazionale'
    `;
    
    await client.query(addColumnQuery);
    console.log('✅ Colonna grado_opinione aggiunta con successo');
    
    // 3. Aggiorna le opinioni esistenti con il grado appropriato
    const updateOpinionsQuery = `
      UPDATE opinioni 
      SET grado_opinione = CASE 
        WHEN text ILIKE '%comunale%' OR text ILIKE '%cassonetti%' OR text ILIKE '%biblioteca%' OR text ILIKE '%piste%' OR text ILIKE '%asili%' OR text ILIKE '%stadio%' OR text ILIKE '%parcheggi%' OR text ILIKE '%trasporto%' OR text ILIKE '%tasse%' OR text ILIKE '%sicurezza%' OR text ILIKE '%commercio%' OR text ILIKE '%verde%' THEN 'Comunale'
        WHEN text ILIKE '%europeo%' OR text ILIKE '%ue%' OR text ILIKE '%europa%' THEN 'Europeo'
        WHEN text ILIKE '%regionale%' OR text ILIKE '%regione%' THEN 'Regionale'
        WHEN text ILIKE '%provinciale%' OR text ILIKE '%provincia%' THEN 'Provinciale'
        ELSE 'Nazionale'
      END
      WHERE grado_opinione IS NULL OR grado_opinione = 'Nazionale'
    `;
    
    const updateResult = await client.query(updateOpinionsQuery);
    console.log(`✅ Aggiornate ${updateResult.rowCount} opinioni con il grado appropriato`);
    
    // 4. Verifica il risultato
    const verifyQuery = `
      SELECT grado_opinione, COUNT(*) as count 
      FROM opinioni 
      GROUP BY grado_opinione 
      ORDER BY grado_opinione
    `;
    
    const verifyResult = await client.query(verifyQuery);
    console.log('📊 Distribuzione opinioni per grado:');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.grado_opinione}: ${row.count}`);
    });
    
    client.release();
    console.log('✅ Operazione completata con successo');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta della colonna:', error);
  } finally {
    await pool.end();
  }
}

addGradoOpinioneColumn();
