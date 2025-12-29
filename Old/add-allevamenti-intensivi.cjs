const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function addAllevamentiIntensivi() {
  console.log('🔧 Aggiungo "Allevamenti Intensivi" come opinione da approvare...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // Genera ID univoco per l'opinione
    const id = require('crypto').randomUUID();
    
    // Inserisce "Allevamenti Intensivi" come opinione da approvare
    const insertQuery = `
      INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        gradi_opinione = EXCLUDED.gradi_opinione,
        approfondimento = EXCLUDED.approfondimento
    `;
    
    const text = 'Allevamenti Intensivi';
    const gradiOpinione = ['da approvare'];
    const approfondimento = `## Proposta da approvare\n\n${text}\n\nQuesta opinione è stata aggiunta per testare il sistema di gestione delle opinioni.`;
    
    const result = await client.query(insertQuery, [id, text, gradiOpinione, approfondimento]);
    
    console.log('✅ Opinione "Allevamenti Intensivi" aggiunta con successo!');
    console.log(`📋 ID: ${id}`);
    console.log(`📋 Testo: ${text}`);
    console.log(`📋 Gradi: [${gradiOpinione.join(', ')}]`);
    
    // Verifica che l'opinione sia stata inserita
    const verifyQuery = `
      SELECT id, text, gradi_opinione 
      FROM opinioni_domande 
      WHERE text = $1
    `;
    
    const verifyResult = await client.query(verifyQuery, [text]);
    
    if (verifyResult.rows.length > 0) {
      const opinione = verifyResult.rows[0];
      console.log('✅ Verifica completata:');
      console.log(`  - ID: ${opinione.id}`);
      console.log(`  - Testo: ${opinione.text}`);
      console.log(`  - Gradi: [${opinione.gradi_opinione.join(', ')}]`);
    }
    
    console.log('\n🎯 L\'opinione "Allevamenti Intensivi" è ora disponibile:');
    console.log('  - Su https://www.demos.community/proponi-opinione');
    console.log('  - Su https://www.demos.community/gestisci-opinioni');
    
  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('📋 Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

addAllevamentiIntensivi();