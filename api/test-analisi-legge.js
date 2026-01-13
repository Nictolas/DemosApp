// Test completo per il servizio di analisi legge
// Verifica: generazione analisi, cache, estrazione numero legge

const { Pool } = require('pg');
const { 
  generaAnalisiLegge, 
  recuperaAnalisiDaCache,
  estraiNumeroLegge,
  estraiTipoAtto,
  ensureTableExists
} = require('./services/leggeAnalysisService');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testEstraiNumeroLegge() {
  console.log('\n📋 TEST 1: Estrazione numero legge dal titolo');
  console.log('='.repeat(60));
  
  const testCases = [
    'Disegno di legge n. 1718. Votazione questione fiducia',
    'DDL 1234',
    'Mozione n. 567',
    'Decreto legge n. 89',
    'Votazione finale',
    'Ordine del giorno 9/2750/178'
  ];
  
  testCases.forEach(titolo => {
    const numero = estraiNumeroLegge(titolo);
    const tipo = estraiTipoAtto(titolo);
    console.log(`Titolo: "${titolo}"`);
    console.log(`  → Numero: ${numero || 'N/A'}`);
    console.log(`  → Tipo: ${tipo || 'N/A'}`);
    console.log('');
  });
}

async function testTabellaEsiste() {
  console.log('\n📋 TEST 2: Verifica esistenza tabella');
  console.log('='.repeat(60));
  
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'parlamento_analisi_legge'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('✅ Tabella parlamento_analisi_legge esiste');
      
      // Conta righe
      const countResult = await pool.query('SELECT COUNT(*) as count FROM parlamento_analisi_legge');
      console.log(`   Righe presenti: ${countResult.rows[0].count}`);
    } else {
      console.log('❌ Tabella parlamento_analisi_legge NON esiste');
      console.log('   Esegui: psql $DATABASE_URL -f create-parlamento-analisi-legge-table.sql');
    }
  } catch (error) {
    console.error('❌ Errore verifica tabella:', error.message);
  }
}

async function testRecuperaVotazioneEsistente() {
  console.log('\n📋 TEST 3: Recupero votazione esistente dal database');
  console.log('='.repeat(60));
  
  try {
    // Recupera una votazione esistente
    const result = await pool.query(`
      SELECT uri, titolo, descrizione, camera, data_votazione
      FROM parlamento
      WHERE titolo IS NOT NULL AND titolo != ''
      ORDER BY data_votazione DESC NULLS LAST, created_at DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nessuna votazione trovata nel database');
      console.log('   Esegui prima la sincronizzazione votazioni');
      return null;
    }
    
    const votazione = result.rows[0];
    console.log('✅ Votazione trovata:');
    console.log(`   URI: ${votazione.uri}`);
    console.log(`   Titolo: ${votazione.titolo}`);
    console.log(`   Camera: ${votazione.camera}`);
    console.log(`   Data: ${votazione.data_votazione || 'N/A'}`);
    
    return votazione;
  } catch (error) {
    console.error('❌ Errore recupero votazione:', error.message);
    return null;
  }
}

async function testCache() {
  console.log('\n📋 TEST 4: Test cache (recupero analisi esistente)');
  console.log('='.repeat(60));
  
  try {
    // Verifica se ci sono analisi in cache
    const cacheResult = await pool.query(`
      SELECT uri_votazione, numero_legge, tipo_atto, 
             LENGTH(spiegazione_generale) as len_spiegazione,
             LENGTH(effetti_positivi) as len_positivi,
             LENGTH(effetti_negativi) as len_negativi,
             provider_ai, modello_ai, data_generazione
      FROM parlamento_analisi_legge
      ORDER BY data_generazione DESC
      LIMIT 1
    `);
    
    if (cacheResult.rows.length === 0) {
      console.log('⚠️ Nessuna analisi in cache');
      return null;
    }
    
    const analisi = cacheResult.rows[0];
    console.log('✅ Analisi trovata in cache:');
    console.log(`   URI: ${analisi.uri_votazione}`);
    console.log(`   Numero legge: ${analisi.numero_legge || 'N/A'}`);
    console.log(`   Tipo atto: ${analisi.tipo_atto || 'N/A'}`);
    console.log(`   Spiegazione: ${analisi.len_spiegazione} caratteri`);
    console.log(`   Effetti positivi: ${analisi.len_positivi} caratteri`);
    console.log(`   Effetti negativi: ${analisi.len_negativi} caratteri`);
    console.log(`   Provider: ${analisi.provider_ai}`);
    console.log(`   Modello: ${analisi.modello_ai}`);
    console.log(`   Data generazione: ${analisi.data_generazione}`);
    
    // Test recupero funzione
    const recuperata = await recuperaAnalisiDaCache(analisi.uri_votazione);
    if (recuperata) {
      console.log('✅ Funzione recuperaAnalisiDaCache() funziona correttamente');
    } else {
      console.log('❌ Funzione recuperaAnalisiDaCache() non ha restituito dati');
    }
    
    return analisi.uri_votazione;
  } catch (error) {
    console.error('❌ Errore test cache:', error.message);
    return null;
  }
}

async function testGenerazioneAnalisi() {
  console.log('\n📋 TEST 5: Generazione nuova analisi (richiede AI configurata)');
  console.log('='.repeat(60));
  
  // Verifica se AI è configurata
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log('⚠️ AI non configurata (manca GROQ_API_KEY o OPENAI_API_KEY)');
    console.log('   Salto test generazione');
    return;
  }
  
  // Recupera una votazione
  const votazione = await testRecuperaVotazioneEsistente();
  if (!votazione) {
    console.log('⚠️ Impossibile testare: nessuna votazione disponibile');
    return;
  }
  
  // Verifica se esiste già in cache
  const esistente = await recuperaAnalisiDaCache(votazione.uri);
  if (esistente) {
    console.log('ℹ️ Analisi già presente in cache per questa votazione');
    console.log('   Per testare la generazione, elimina prima la riga dalla tabella');
    console.log(`   DELETE FROM parlamento_analisi_legge WHERE uri_votazione = '${votazione.uri}';`);
    return;
  }
  
  console.log('🔄 Generazione nuova analisi...');
  console.log('   (Questo richiederà ~2-3 secondi)');
  
  try {
    const startTime = Date.now();
    
    const analisi = await generaAnalisiLegge(votazione.uri, {
      titolo: votazione.titolo,
      descrizione: votazione.descrizione || votazione.titolo,
      camera: votazione.camera,
      data_votazione: votazione.data_votazione
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    if (analisi) {
      console.log(`✅ Analisi generata con successo in ${duration}s`);
      console.log(`   Numero legge: ${analisi.numero_legge || 'N/A'}`);
      console.log(`   Tipo atto: ${analisi.tipo_atto || 'N/A'}`);
      console.log(`   Provider: ${analisi.provider_ai}`);
      console.log(`   Modello: ${analisi.modello_ai}`);
      console.log(`   Spiegazione: ${analisi.spiegazione_generale ? analisi.spiegazione_generale.substring(0, 100) + '...' : 'N/A'}`);
      console.log(`   Effetti positivi: ${analisi.effetti_positivi ? analisi.effetti_positivi.substring(0, 100) + '...' : 'N/A'}`);
      console.log(`   Effetti negativi: ${analisi.effetti_negativi ? analisi.effetti_negativi.substring(0, 100) + '...' : 'N/A'}`);
      
      // Verifica che sia stata salvata in cache
      const verificata = await recuperaAnalisiDaCache(votazione.uri);
      if (verificata) {
        console.log('✅ Analisi salvata correttamente in cache');
      } else {
        console.log('⚠️ Analisi generata ma non trovata in cache');
      }
    } else {
      console.log('❌ Analisi non generata (null)');
    }
  } catch (error) {
    console.error('❌ Errore generazione analisi:', error.message);
    console.error('   Stack:', error.stack);
  }
}

async function testEndpoint() {
  console.log('\n📋 TEST 6: Test endpoint API (richiede server avviato)');
  console.log('='.repeat(60));
  
  const axios = require('axios');
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  
  try {
    // Recupera una votazione dal database per testare l'endpoint
    const result = await pool.query(`
      SELECT uri
      FROM parlamento
      WHERE titolo IS NOT NULL AND titolo != ''
      ORDER BY data_votazione DESC NULLS LAST, created_at DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nessuna votazione disponibile per testare endpoint');
      return;
    }
    
    const uri = encodeURIComponent(result.rows[0].uri);
    const url = `${baseUrl}/api/voti-politici/dettagli/${uri}`;
    
    console.log(`🔄 Test chiamata: GET ${url}`);
    
    try {
      const response = await axios.get(url, {
        timeout: 30000 // 30 secondi (la generazione AI può richiedere tempo)
      });
      
      if (response.data && response.data.success) {
        const dettagli = response.data.data;
        console.log('✅ Endpoint risponde correttamente');
        console.log(`   Titolo: ${dettagli.titolo}`);
        console.log(`   Camera: ${dettagli.camera}`);
        
        if (dettagli.analisi_legge) {
          console.log('✅ Analisi legge presente nella response');
          console.log(`   Spiegazione: ${dettagli.analisi_legge.spiegazione_generale ? 'Presente' : 'Assente'}`);
          console.log(`   Effetti positivi: ${dettagli.analisi_legge.effetti_positivi ? 'Presenti' : 'Assenti'}`);
          console.log(`   Effetti negativi: ${dettagli.analisi_legge.effetti_negativi ? 'Presenti' : 'Assenti'}`);
        } else {
          console.log('⚠️ Analisi legge non presente nella response');
          console.log('   (Potrebbe essere in generazione o AI non configurata)');
        }
      } else {
        console.log('❌ Endpoint non ha restituito success: true');
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('⚠️ Server non avviato o non raggiungibile');
        console.log(`   URL testato: ${baseUrl}`);
        console.log('   Avvia il server con: npm start o node server.js');
      } else {
        console.error('❌ Errore chiamata endpoint:', error.message);
        if (error.response) {
          console.error(`   Status: ${error.response.status}`);
          console.error(`   Data: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Errore test endpoint:', error.message);
  }
}

async function runAllTests() {
  console.log('🧪 TEST COMPLETO: Analisi Legge');
  console.log('='.repeat(60));
  console.log(`Database: ${process.env.DATABASE_URL ? 'Configurato' : 'NON configurato'}`);
  console.log(`Groq API: ${process.env.GROQ_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  
  try {
    await testEstraiNumeroLegge();
    await testTabellaEsiste();
    await testRecuperaVotazioneEsistente();
    await testCache();
    await testGenerazioneAnalisi();
    await testEndpoint();
    
    console.log('\n✅ Test completati');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Errore durante i test:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Esegui i test
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
