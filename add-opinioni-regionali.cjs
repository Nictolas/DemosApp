const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addOpinioniRegionali() {
  console.log('🔧 Aggiungo opinioni regionali e aggiorno Caccia...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // 1. Aggiungi le nuove opinioni regionali
    const insertOpinioniQuery = `
      INSERT INTO opinioni (text, gradi_opinione, created_at, updated_at) 
      VALUES 
        ('Nuovi inceneritori', ARRAY['Regionale'], NOW(), NOW()),
        ('Chiusura ospedali di provincia', ARRAY['Regionale'], NOW(), NOW())
      ON CONFLICT (text) DO NOTHING
      RETURNING id, text, gradi_opinione
    `;
    
    const insertResult = await client.query(insertOpinioniQuery);
    console.log(`✅ Inserite ${insertResult.rowCount} nuove opinioni regionali`);
    
    if (insertResult.rows.length > 0) {
      insertResult.rows.forEach(row => {
        console.log(`  - "${row.text}" → [${row.gradi_opinione.join(', ')}]`);
      });
    }
    
    // 2. Aggiorna "Caccia" per includere anche il grado "Regionale"
    const updateCacciaQuery = `
      UPDATE opinioni 
      SET gradi_opinione = ARRAY['Nazionale', 'Europeo', 'Regionale']
      WHERE text = 'Caccia'
      RETURNING id, text, gradi_opinione
    `;
    
    const updateResult = await client.query(updateCacciaQuery);
    if (updateResult.rows.length > 0) {
      const caccia = updateResult.rows[0];
      console.log(`✅ Aggiornata opinione "Caccia": [${caccia.gradi_opinione.join(', ')}]`);
    } else {
      console.log('⚠️ Opinione "Caccia" non trovata');
    }
    
    // 3. Aggiungi le colonne per le opinioni regionali nella tabella users
    const addColumnsQuery = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS regionale_nuovi_inceneritori TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS regionale_chiusura_ospedali_di_provincia TEXT DEFAULT NULL
    `;
    
    await client.query(addColumnsQuery);
    console.log('✅ Colonne per opinioni regionali aggiunte alla tabella users');
    
    // 4. Verifica il risultato finale
    const verifyQuery = `
      SELECT 
        text,
        gradi_opinione,
        array_length(gradi_opinione, 1) as num_gradi
      FROM opinioni 
      WHERE 'Regionale' = ANY(gradi_opinione)
      ORDER BY text
    `;
    
    const verifyResult = await client.query(verifyQuery);
    console.log('\n📊 Opinion regionali disponibili:');
    verifyResult.rows.forEach(row => {
      console.log(`  "${row.text}" → [${row.gradi_opinione.join(', ')}] (${row.num_gradi} gradi)`);
    });
    
    // 5. Verifica le colonne nella tabella users
    const checkColumnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name LIKE 'regionale_%'
      ORDER BY column_name
    `;
    
    const columnsResult = await client.query(checkColumnsQuery);
    console.log('\n📋 Colonne opinioni regionali in users:');
    columnsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    client.release();
    console.log('\n✅ Operazione completata con successo');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta:', error);
  } finally {
    await pool.end();
  }
}

addOpinioniRegionali();
