require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Test completo che simula esattamente l'endpoint POST /api/voti-camera/votazione/:votazione_id/spiegazione
 */
async function testEndpointSpiegazione() {
  console.log('='.repeat(60));
  console.log('TEST COMPLETO ENDPOINT SPIEGAZIONE');
  console.log('='.repeat(60));
  
  const votazioneId = 2; // Stesso ID dell'errore
  
  try {
    // Step 1: Verifica votazione esiste
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
    
    const row = votazioneResult.rows[0];
    console.log(`✅ Votazione trovata:`);
    console.log(`   Titolo: ${row.titolo_votazione}`);
    console.log(`   Camera: ${row.camera}`);
    console.log(`   Spiegazione esistente: ${row.spiegazione ? 'SÌ' : 'NO'}`);
    
    if (row.spiegazione && row.spiegazione.trim() !== '') {
      console.log(`\n✅ Spiegazione già esistente, test completato`);
      return;
    }
    
    // Step 2: Verifica configurazione AI
    console.log(`\n[2] Verifica configurazione AI`);
    console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Configurata' : '❌ NON configurata'}`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurata' : '❌ NON configurata'}`);
    
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      console.log(`\n❌ ERRORE: Nessuna API AI configurata!`);
      return;
    }
    
    // Step 3: Carica servizio AI (simula require)
    console.log(`\n[3] Caricamento servizio AI`);
    const { generaSpiegazioneVotazione, verificaLimiteGiornaliero } = require('./services/aiExplanationService');
    
    // Step 4: Verifica limite
    console.log(`\n[4] Verifica limite giornaliero`);
    const limiteCheck = await verificaLimiteGiornaliero();
    console.log(`   Risultato: rispettato=${limiteCheck.rispettato}, count=${limiteCheck.count}, limite=${limiteCheck.limite}`);
    
    if (!limiteCheck.rispettato) {
      console.log(`\n❌ Limite giornaliero raggiunto`);
      return;
    }
    
    // Step 5: Genera spiegazione (QUESTO È IL PUNTO CRITICO)
    console.log(`\n[5] Generazione spiegazione AI`);
    console.log(`   Parametri: votazione_id=${votazioneId}, titolo="${row.titolo_votazione}", camera="${row.camera}"`);
    
    try {
      const spiegazione = await generaSpiegazioneVotazione(
        votazioneId,
        row.titolo_votazione,
        row.descrizione_votazione || null,
        row.camera
      );
      
      if (spiegazione) {
        console.log(`\n✅ SUCCESSO! Spiegazione generata:`);
        console.log(`   Lunghezza: ${spiegazione.length} caratteri`);
        console.log(`   Anteprima: ${spiegazione.substring(0, 200)}...`);
      } else {
        console.log(`\n❌ Spiegazione NON generata (null o vuota)`);
      }
      
    } catch (genError) {
      console.error(`\n❌ ERRORE durante la generazione:`);
      console.error(`   Tipo: ${genError.constructor.name}`);
      console.error(`   Messaggio: ${genError.message}`);
      console.error(`   Stack:`, genError.stack);
      
      if (genError.message && genError.message.includes('decommissioned')) {
        console.error(`\n⚠️  PROBLEMA: Modello deprecato!`);
        console.error(`   Il codice su Render sta ancora usando llama-3.1-70b-versatile`);
        console.error(`   Soluzione: Fai redeploy su Render`);
      }
      
      throw genError;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETATO');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRORE NEL TEST:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Esegui il test
testEndpointSpiegazione().catch(console.error);
