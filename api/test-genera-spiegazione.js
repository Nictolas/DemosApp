require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

/**
 * Test: Simula la generazione spiegazione per votazione_id = 16
 */
async function testGeneraSpiegazione() {
  console.log('='.repeat(60));
  console.log('TEST GENERAZIONE SPIEGAZIONE');
  console.log('='.repeat(60));
  
  const votazioneId = 16;
  
  try {
    // Step 1: Verifica che la votazione esista
    console.log(`\n[1] Verifica votazione ID=${votazioneId}`);
    const votazioneResult = await pool.query(
      `SELECT id, titolo_votazione, descrizione_votazione, camera, spiegazione
       FROM votazioni_parlamento
       WHERE id = $1`,
      [votazioneId]
    );
    
    if (votazioneResult.rows.length === 0) {
      console.log(`❌ Votazione ${votazioneId} non trovata`);
      return;
    }
    
    const votazione = votazioneResult.rows[0];
    console.log(`✅ Votazione trovata:`);
    console.log(`   Titolo: ${votazione.titolo_votazione}`);
    console.log(`   Camera: ${votazione.camera}`);
    console.log(`   Descrizione: ${votazione.descrizione_votazione ? votazione.descrizione_votazione.substring(0, 100) + '...' : 'NON DISPONIBILE'}`);
    console.log(`   Spiegazione esistente: ${votazione.spiegazione ? 'SÌ' : 'NO'}`);
    
    // Step 2: Verifica API AI configurata
    console.log(`\n[2] Verifica configurazione AI`);
    console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Configurata' : '❌ NON configurata'}`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurata' : '❌ NON configurata'}`);
    
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      console.log(`\n❌ ERRORE: Nessuna API AI configurata!`);
      console.log(`   Configura GROQ_API_KEY o OPENAI_API_KEY nelle variabili d'ambiente`);
      return;
    }
    
    // Step 3: Test chiamata servizio AI
    console.log(`\n[3] Test chiamata servizio AI`);
    try {
      const { generaSpiegazioneVotazione } = require('./services/aiExplanationService');
      
      console.log(`   Chiamata generaSpiegazioneVotazione(${votazioneId}, "${votazione.titolo_votazione}", ...)`);
      
      const spiegazione = await generaSpiegazioneVotazione(
        votazioneId,
        votazione.titolo_votazione,
        votazione.descrizione_votazione || null,
        votazione.camera
      );
      
      if (spiegazione) {
        console.log(`✅ Spiegazione generata con successo!`);
        console.log(`   Lunghezza: ${spiegazione.length} caratteri`);
        console.log(`   Anteprima: ${spiegazione.substring(0, 150)}...`);
      } else {
        console.log(`❌ Spiegazione NON generata (null o vuota)`);
      }
      
    } catch (aiError) {
      console.error(`❌ ERRORE nella chiamata AI:`, aiError.message);
      console.error(`   Stack:`, aiError.stack);
    }
    
    // Step 4: Verifica limite giornaliero
    console.log(`\n[4] Verifica limite giornaliero`);
    try {
      const { verificaLimiteGiornaliero } = require('./services/aiExplanationService');
      const limiteCheck = await verificaLimiteGiornaliero();
      console.log(`   Limite rispettato: ${limiteCheck.rispettato ? '✅ SÌ' : '❌ NO'}`);
      console.log(`   Count: ${limiteCheck.count}/${limiteCheck.limite}`);
    } catch (limiteError) {
      console.error(`❌ ERRORE verifica limite:`, limiteError.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETATO');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRORE NEL TEST:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Esegui il test
testGeneraSpiegazione().catch(console.error);
