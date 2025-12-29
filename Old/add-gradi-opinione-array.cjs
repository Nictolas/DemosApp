const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addGradiOpinioneArray() {
  console.log('🔧 Modifica tabella opinioni per supportare gradi multipli...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // 1. Verifica se la colonna gradi_opinione esiste già
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      AND column_name = 'gradi_opinione'
    `;
    
    const checkResult = await client.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️ La colonna gradi_opinione esiste già');
    } else {
      // 2. Aggiungi la colonna gradi_opinione come array
      const addColumnQuery = `
        ALTER TABLE opinioni 
        ADD COLUMN gradi_opinione TEXT[] DEFAULT ARRAY['Nazionale']
      `;
      
      await client.query(addColumnQuery);
      console.log('✅ Colonna gradi_opinione aggiunta con successo');
    }
    
    // 3. Aggiorna le opinioni esistenti con i gradi appropriati
    const updateOpinionsQuery = `
      UPDATE opinioni 
      SET gradi_opinione = CASE 
        -- Opinion nazionali che sono anche europee
        WHEN text ILIKE '%energia%' AND text ILIKE '%nucleare%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%sperimentazione%' AND text ILIKE '%animale%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%legalizzazione%' AND text ILIKE '%canapa%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%caccia%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%eutanasia%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%carne%' AND text ILIKE '%coltivata%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%cittadina%' AND text ILIKE '%animale%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%nato%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%matrimonio%' AND text ILIKE '%gay%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%salario%' AND text ILIKE '%minimo%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%case%' AND text ILIKE '%chiuse%' THEN ARRAY['Nazionale', 'Europeo']
        WHEN text ILIKE '%omobitransfobia%' THEN ARRAY['Nazionale', 'Europeo']
        
        -- Opinion comunali
        WHEN text ILIKE '%comunale%' OR text ILIKE '%cassonetti%' OR text ILIKE '%biblioteca%' OR text ILIKE '%piste%' OR text ILIKE '%asili%' OR text ILIKE '%stadio%' OR text ILIKE '%parcheggi%' OR text ILIKE '%trasporto%' OR text ILIKE '%tasse%' OR text ILIKE '%sicurezza%' OR text ILIKE '%commercio%' OR text ILIKE '%verde%' THEN ARRAY['Comunale']
        
        -- Opinion regionali
        WHEN text ILIKE '%regionale%' OR text ILIKE '%regione%' THEN ARRAY['Regionale']
        
        -- Opinion provinciali
        WHEN text ILIKE '%provinciale%' OR text ILIKE '%provincia%' THEN ARRAY['Provinciale']
        
        -- Default per opinion nazionali
        ELSE ARRAY['Nazionale']
      END
      WHERE gradi_opinione IS NULL OR gradi_opinione = ARRAY['Nazionale']
    `;
    
    const updateResult = await client.query(updateOpinionsQuery);
    console.log(`✅ Aggiornate ${updateResult.rowCount} opinioni con i gradi appropriati`);
    
    // 4. Verifica il risultato
    const verifyQuery = `
      SELECT 
        text,
        gradi_opinione,
        array_length(gradi_opinione, 1) as num_gradi
      FROM opinioni 
      ORDER BY array_length(gradi_opinione, 1) DESC, text
      LIMIT 10
    `;
    
    const verifyResult = await client.query(verifyQuery);
    console.log('📊 Esempi opinioni con gradi:');
    verifyResult.rows.forEach(row => {
      console.log(`  "${row.text}" → [${row.gradi_opinione.join(', ')}] (${row.num_gradi} gradi)`);
    });
    
    // 5. Statistiche per grado
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
    
    client.release();
    console.log('✅ Operazione completata con successo');
    
  } catch (error) {
    console.error('❌ Errore durante la modifica:', error);
  } finally {
    await pool.end();
  }
}

addGradiOpinioneArray();
