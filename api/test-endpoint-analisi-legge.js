// Test completo endpoint API per analisi legge
require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testEndpointDettagli() {
  console.log('🧪 TEST: Endpoint API /api/voti-politici/dettagli/:uri');
  console.log('='.repeat(60));
  
  try {
    // Recupera una votazione dal database
    const result = await pool.query(`
      SELECT uri, titolo, camera, data_votazione
      FROM parlamento
      WHERE titolo IS NOT NULL AND titolo != ''
      ORDER BY data_votazione DESC NULLS LAST, created_at DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nessuna votazione disponibile per testare');
      return false;
    }
    
    const votazione = result.rows[0];
    const uri = encodeURIComponent(votazione.uri);
    const url = `${API_URL}/api/voti-politici/dettagli/${uri}`;
    
    console.log(`📋 Votazione test:`);
    console.log(`   Titolo: ${votazione.titolo}`);
    console.log(`   Camera: ${votazione.camera}`);
    console.log(`   URI: ${votazione.uri}`);
    console.log(`\n🔄 Chiamata: GET ${url}`);
    console.log('   (Attendere, può richiedere 2-3 secondi se deve generare analisi AI)...\n');
    
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        timeout: 30000, // 30 secondi (generazione AI può richiedere tempo)
        validateStatus: (status) => status < 500 // Accetta 4xx ma non 5xx
      });
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Risposta ricevuta in ${duration}s`);
      console.log(`   Status: ${response.status}`);
      
      if (response.status !== 200) {
        console.log(`❌ Status non 200: ${response.status}`);
        if (response.data) {
          console.log(`   Messaggio: ${JSON.stringify(response.data)}`);
        }
        return false;
      }
      
      if (!response.data || !response.data.success) {
        console.log('❌ Response non valida (manca success: true)');
        console.log(`   Data: ${JSON.stringify(response.data)}`);
        return false;
      }
      
      const dettagli = response.data.data;
      
      console.log('\n📊 Dettagli ricevuti:');
      console.log(`   ✅ Titolo: ${dettagli.titolo || 'N/A'}`);
      console.log(`   ✅ Camera: ${dettagli.camera || 'N/A'}`);
      console.log(`   ✅ Data: ${dettagli.data_votazione || 'N/A'}`);
      console.log(`   ✅ Esito: ${dettagli.esito || 'N/A'}`);
      
      // Verifica analisi legge
      if (dettagli.analisi_legge) {
        console.log('\n✅ ANALISI LEGGE PRESENTE:');
        const analisi = dettagli.analisi_legge;
        
        console.log(`   Numero legge: ${analisi.numero_legge || 'N/A'}`);
        console.log(`   Tipo atto: ${analisi.tipo_atto || 'N/A'}`);
        console.log(`   Provider AI: ${analisi.provider_ai || 'N/A'}`);
        console.log(`   Modello AI: ${analisi.modello_ai || 'N/A'}`);
        
        if (analisi.spiegazione_generale) {
          const len = analisi.spiegazione_generale.length;
          console.log(`   ✅ Spiegazione generale: ${len} caratteri`);
          console.log(`      Preview: ${analisi.spiegazione_generale.substring(0, 100)}...`);
        } else {
          console.log(`   ⚠️ Spiegazione generale: ASSENTE`);
        }
        
        if (analisi.effetti_positivi) {
          const len = analisi.effetti_positivi.length;
          const lines = analisi.effetti_positivi.split('\n').filter(l => l.trim()).length;
          console.log(`   ✅ Effetti positivi: ${len} caratteri, ~${lines} punti`);
          console.log(`      Preview: ${analisi.effetti_positivi.substring(0, 80)}...`);
        } else {
          console.log(`   ⚠️ Effetti positivi: ASSENTI`);
        }
        
        if (analisi.effetti_negativi) {
          const len = analisi.effetti_negativi.length;
          const lines = analisi.effetti_negativi.split('\n').filter(l => l.trim()).length;
          console.log(`   ✅ Effetti negativi: ${len} caratteri, ~${lines} punti`);
          console.log(`      Preview: ${analisi.effetti_negativi.substring(0, 80)}...`);
        } else {
          console.log(`   ⚠️ Effetti negativi: ASSENTI`);
        }
        
        // Verifica che almeno uno dei tre sia presente
        if (!analisi.spiegazione_generale && !analisi.effetti_positivi && !analisi.effetti_negativi) {
          console.log('\n   ⚠️ ATTENZIONE: Analisi presente ma tutti i campi sono vuoti');
        } else {
          console.log('\n   ✅ Analisi completa e valida!');
        }
        
        return true;
      } else {
        console.log('\n⚠️ ANALISI LEGGE ASSENTE nella response');
        console.log('   Possibili cause:');
        console.log('   - AI non configurata (manca GROQ_API_KEY o OPENAI_API_KEY)');
        console.log('   - Errore durante generazione analisi');
        console.log('   - Votazione non supportata');
        
        // Verifica se AI è configurata
        if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
          console.log('\n   💡 AI non configurata - questo è normale se non hai ancora configurato Groq');
        }
        
        return false;
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Server non raggiungibile');
        console.log(`   URL testato: ${API_URL}`);
        console.log('   Verifica che il server sia avviato:');
        console.log('   - npm start');
        console.log('   - node server.js');
        console.log('   - node index.js');
        return false;
      } else if (error.response) {
        console.log(`❌ Errore HTTP: ${error.response.status}`);
        console.log(`   Messaggio: ${JSON.stringify(error.response.data)}`);
        return false;
      } else {
        console.error('❌ Errore:', error.message);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Errore test endpoint:', error.message);
    return false;
  }
}

async function testCache() {
  console.log('\n🧪 TEST: Verifica cache analisi');
  console.log('='.repeat(60));
  
  try {
    const result = await pool.query(`
      SELECT uri_votazione, numero_legge, tipo_atto,
             spiegazione_generale IS NOT NULL as has_spiegazione,
             effetti_positivi IS NOT NULL as has_positivi,
             effetti_negativi IS NOT NULL as has_negativi,
             provider_ai, modello_ai, data_generazione
      FROM parlamento_analisi_legge
      ORDER BY data_generazione DESC
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nessuna analisi in cache');
      console.log('   Le analisi verranno generate al primo accesso');
      return true;
    }
    
    console.log(`✅ Trovate ${result.rows.length} analisi in cache:`);
    result.rows.forEach((analisi, i) => {
      console.log(`\n   ${i + 1}. URI: ${analisi.uri_votazione.substring(0, 60)}...`);
      console.log(`      Numero legge: ${analisi.numero_legge || 'N/A'}`);
      console.log(`      Tipo atto: ${analisi.tipo_atto || 'N/A'}`);
      console.log(`      Spiegazione: ${analisi.has_spiegazione ? '✅' : '❌'}`);
      console.log(`      Effetti positivi: ${analisi.has_positivi ? '✅' : '❌'}`);
      console.log(`      Effetti negativi: ${analisi.has_negativi ? '✅' : '❌'}`);
      console.log(`      Provider: ${analisi.provider_ai || 'N/A'}`);
      console.log(`      Data: ${analisi.data_generazione}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Errore verifica cache:', error.message);
    return false;
  }
}

async function testGenerazioneDiretta() {
  console.log('\n🧪 TEST: Generazione diretta analisi (richiede AI configurata)');
  console.log('='.repeat(60));
  
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log('⚠️ AI non configurata - salto test generazione diretta');
    console.log('   Configura GROQ_API_KEY per testare la generazione');
    return false;
  }
  
  try {
    const { generaAnalisiLegge } = require('./services/leggeAnalysisService');
    
    // Recupera una votazione
    const result = await pool.query(`
      SELECT uri, titolo, descrizione, camera, data_votazione
      FROM parlamento
      WHERE titolo IS NOT NULL AND titolo != ''
      ORDER BY data_votazione DESC NULLS LAST, created_at DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nessuna votazione disponibile');
      return false;
    }
    
    const votazione = result.rows[0];
    
    // Verifica se esiste già
    const cacheCheck = await pool.query(`
      SELECT uri_votazione FROM parlamento_analisi_legge WHERE uri_votazione = $1
    `, [votazione.uri]);
    
    if (cacheCheck.rows.length > 0) {
      console.log('ℹ️ Analisi già presente in cache per questa votazione');
      console.log('   Elimino dalla cache per testare generazione...');
      await pool.query('DELETE FROM parlamento_analisi_legge WHERE uri_votazione = $1', [votazione.uri]);
    }
    
    console.log(`🔄 Generazione analisi per: ${votazione.titolo}`);
    console.log('   (Questo richiederà ~2-3 secondi)...\n');
    
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
      console.log(`   Spiegazione: ${analisi.spiegazione_generale ? analisi.spiegazione_generale.substring(0, 80) + '...' : 'N/A'}`);
      console.log(`   Effetti positivi: ${analisi.effetti_positivi ? 'Presenti' : 'Assenti'}`);
      console.log(`   Effetti negativi: ${analisi.effetti_negativi ? 'Presenti' : 'Assenti'}`);
      return true;
    } else {
      console.log('❌ Analisi non generata (null)');
      return false;
    }
  } catch (error) {
    console.error('❌ Errore generazione diretta:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 TEST COMPLETO: Endpoint Analisi Legge');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log('');
  
  const results = {
    endpoint: false,
    cache: false,
    generazione: false
  };
  
  try {
    results.endpoint = await testEndpointDettagli();
    results.cache = await testCache();
    
    if (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) {
      results.generazione = await testGenerazioneDiretta();
    } else {
      console.log('\n⚠️ Salto test generazione diretta (AI non configurata)');
    }
    
    console.log('\n📊 RIEPILOGO FINALE');
    console.log('='.repeat(60));
    console.log(`Endpoint API: ${results.endpoint ? '✅' : '❌'}`);
    console.log(`Cache verificata: ${results.cache ? '✅' : '❌'}`);
    console.log(`Generazione diretta: ${results.generazione ? '✅' : results.generazione === false && (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) ? '❌' : '⏭️ (saltato)'}`);
    
    const allOk = results.endpoint && results.cache;
    if (allOk) {
      console.log('\n✅ Test principali completati con successo!');
      if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
        console.log('\n💡 Per testare la generazione AI:');
        console.log('   1. Configura GROQ_API_KEY nel file .env');
        console.log('   2. Riavvia il server');
        console.log('   3. Esegui di nuovo questo test');
      }
    } else {
      console.log('\n⚠️ Alcuni test non sono passati');
    }
  } catch (error) {
    console.error('\n❌ Errore durante i test:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
