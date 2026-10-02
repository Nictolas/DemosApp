// Test simulato dell'endpoint senza server (testa direttamente la logica)
require('dotenv').config();
const { Pool } = require('pg');
const { generaAnalisiLegge, recuperaAnalisiDaCache } = require('./services/leggeAnalysisService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function testLogicaEndpoint() {
  console.log('🧪 TEST SIMULATO: Logica Endpoint /api/voti-politici/dettagli/:uri');
  console.log('='.repeat(60));
  
  try {
    // Simula la query dell'endpoint
    const result = await pool.query(`
      SELECT 
        p.id,
        p.uri,
        p.votazione_id,
        p.camera,
        p.titolo,
        p.descrizione,
        p.data_votazione,
        p.esito,
        p.uri_seduta,
        p.numero_seduta,
        p.titolo_seduta,
        p.legislatura,
        p.favorevoli,
        p.contrari,
        p.presenti,
        p.votanti,
        p.maggioranza,
        p.tipo_votazione,
        p.approvato,
        p.metadati,
        vp.descrizione_votazione as descrizione_openpolis,
        vp.spiegazione as spiegazione_ai
      FROM parlamento p
      LEFT JOIN votazioni_parlamento vp ON (
        LOWER(TRIM(p.titolo)) = LOWER(TRIM(vp.titolo_votazione))
        AND p.camera = vp.camera
        AND (
          (p.data_votazione IS NULL AND vp.data_votazione IS NULL) OR
          (p.data_votazione = vp.data_votazione)
        )
      )
      WHERE p.uri = $1
      LIMIT 1
    `, ['http://dati.senato.it/votazione/19-378-1']);
    
    if (result.rows.length === 0) {
      console.log('❌ Votazione non trovata');
      return;
    }
    
    const votazione = result.rows[0];
    console.log('✅ Votazione recuperata:');
    console.log(`   Titolo: ${votazione.titolo}`);
    console.log(`   Camera: ${votazione.camera}`);
    console.log(`   URI: ${votazione.uri}\n`);
    
    // Simula la logica di recupero/generazione analisi
    console.log('🔄 Test logica analisi legge...');
    
    const decodedUri = votazione.uri;
    let analisiLegge = null;
    
    // Prima prova a recuperare dalla cache
    console.log('   1. Recupero dalla cache...');
    analisiLegge = await recuperaAnalisiDaCache(decodedUri);
    
    if (analisiLegge) {
      console.log('   ✅ Analisi trovata in cache');
      console.log(`      Numero legge: ${analisiLegge.numero_legge || 'N/A'}`);
      console.log(`      Tipo atto: ${analisiLegge.tipo_atto || 'N/A'}`);
      console.log(`      Provider: ${analisiLegge.provider_ai || 'N/A'}`);
    } else {
      console.log('   ⚠️ Analisi non in cache');
      
      // Se non c'è in cache, genera nuova analisi (solo se AI configurata)
      if (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) {
        console.log('   2. Generazione nuova analisi...');
        try {
          const descrizioneCompleta = votazione.descrizione_openpolis || 
                                     votazione.descrizione || 
                                     votazione.titolo || 
                                     'Votazione parlamentare';
          
          analisiLegge = await generaAnalisiLegge(decodedUri, {
            titolo: votazione.titolo,
            descrizione: descrizioneCompleta,
            camera: votazione.camera,
            data_votazione: votazione.data_votazione
          });
          
          if (analisiLegge) {
            console.log('   ✅ Analisi generata con successo');
            console.log(`      Numero legge: ${analisiLegge.numero_legge || 'N/A'}`);
            console.log(`      Tipo atto: ${analisiLegge.tipo_atto || 'N/A'}`);
            console.log(`      Provider: ${analisiLegge.provider_ai}`);
            console.log(`      Spiegazione: ${analisiLegge.spiegazione_generale ? analisiLegge.spiegazione_generale.substring(0, 60) + '...' : 'N/A'}`);
            console.log(`      Effetti positivi: ${analisiLegge.effetti_positivi ? 'Presenti' : 'Assenti'}`);
            console.log(`      Effetti negativi: ${analisiLegge.effetti_negativi ? 'Presenti' : 'Assenti'}`);
          } else {
            console.log('   ⚠️ Analisi non generata (null)');
          }
        } catch (error) {
          console.log(`   ⚠️ Errore generazione: ${error.message}`);
        }
      } else {
        console.log('   ⚠️ AI non configurata - salto generazione');
      }
    }
    
    // Simula la risposta dell'endpoint
    const descrizioneCompleta = votazione.descrizione_openpolis || 
                               votazione.descrizione || 
                               votazione.titolo || 
                               'Votazione parlamentare';
    
    const dettagli = {
      id: votazione.id,
      uri: votazione.uri,
      votazione_id: votazione.votazione_id,
      camera: votazione.camera,
      titolo: votazione.titolo || 'Votazione parlamentare',
      descrizione: descrizioneCompleta,
      data_votazione: votazione.data_votazione || null,
      esito: votazione.esito,
      legislatura: votazione.legislatura,
      numero_seduta: votazione.numero_seduta,
      titolo_seduta: votazione.titolo_seduta,
      spiegazione: votazione.spiegazione_ai || null,
      favorevoli: votazione.favorevoli,
      contrari: votazione.contrari,
      presenti: votazione.presenti,
      votanti: votazione.votanti,
      maggioranza: votazione.maggioranza,
      tipo_votazione: votazione.tipo_votazione,
      approvato: votazione.approvato
    };
    
    // Aggiungi analisi se disponibile
    if (analisiLegge) {
      dettagli.analisi_legge = {
        spiegazione_generale: analisiLegge.spiegazione_generale,
        effetti_positivi: analisiLegge.effetti_positivi,
        effetti_negativi: analisiLegge.effetti_negativi,
        numero_legge: analisiLegge.numero_legge,
        tipo_atto: analisiLegge.tipo_atto,
        provider_ai: analisiLegge.provider_ai,
        modello_ai: analisiLegge.modello_ai,
        data_generazione: analisiLegge.data_generazione
      };
    }
    
    console.log('\n📊 RISPOSTA SIMULATA:');
    console.log('='.repeat(60));
    console.log(`✅ Success: true`);
    console.log(`✅ Dettagli presenti: ${Object.keys(dettagli).length} campi`);
    console.log(`✅ Analisi legge: ${dettagli.analisi_legge ? 'Presente ✅' : 'Assente ⚠️'}`);
    
    if (dettagli.analisi_legge) {
      console.log(`   - Spiegazione generale: ${dettagli.analisi_legge.spiegazione_generale ? '✅' : '❌'}`);
      console.log(`   - Effetti positivi: ${dettagli.analisi_legge.effetti_positivi ? '✅' : '❌'}`);
      console.log(`   - Effetti negativi: ${dettagli.analisi_legge.effetti_negativi ? '✅' : '❌'}`);
    }
    
    console.log('\n✅ Test logica endpoint completato con successo!');
    console.log('   La logica funziona correttamente anche senza server avviato');
    
  } catch (error) {
    console.error('❌ Errore test logica:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testLogicaEndpoint().catch(console.error);
}

module.exports = { testLogicaEndpoint };
