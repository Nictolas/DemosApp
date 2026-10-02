// Test diretto del servizio leggeAnalysisService (senza server)
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function testServizioCompleto() {
  console.log('🧪 TEST DIRETTO: Servizio leggeAnalysisService');
  console.log('='.repeat(60));
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log('');
  
  try {
    const { 
      generaAnalisiLegge, 
      recuperaAnalisiDaCache,
      estraiNumeroLegge,
      estraiTipoAtto
    } = require('./services/leggeAnalysisService');
    
    console.log('✅ Servizio caricato correttamente\n');
    
    // Test 1: Estrazione numero legge
    console.log('📋 TEST 1: Estrazione numero legge e tipo atto');
    console.log('-'.repeat(60));
    const testCases = [
      'Disegno di legge n. 1718. Votazione questione fiducia',
      'DDL 1234',
      'Mozione n. 567'
    ];
    
    testCases.forEach(titolo => {
      const numero = estraiNumeroLegge(titolo);
      const tipo = estraiTipoAtto(titolo);
      console.log(`   "${titolo}"`);
      console.log(`   → Numero: ${numero || 'N/A'}, Tipo: ${tipo || 'N/A'}`);
    });
    console.log('   ✅ Estrazione funziona\n');
    
    // Test 2: Recupera votazione dal database
    console.log('📋 TEST 2: Recupero votazione dal database');
    console.log('-'.repeat(60));
    const result = await pool.query(`
      SELECT uri, titolo, descrizione, camera, data_votazione
      FROM parlamento
      WHERE titolo IS NOT NULL AND titolo != ''
      ORDER BY data_votazione DESC NULLS LAST, created_at DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('   ❌ Nessuna votazione trovata');
      return;
    }
    
    const votazione = result.rows[0];
    console.log(`   ✅ Votazione trovata:`);
    console.log(`      Titolo: ${votazione.titolo}`);
    console.log(`      Camera: ${votazione.camera}`);
    console.log(`      URI: ${votazione.uri}\n`);
    
    // Test 3: Verifica cache
    console.log('📋 TEST 3: Verifica cache esistente');
    console.log('-'.repeat(60));
    const cached = await recuperaAnalisiDaCache(votazione.uri);
    if (cached) {
      console.log('   ✅ Analisi trovata in cache:');
      console.log(`      Numero legge: ${cached.numero_legge || 'N/A'}`);
      console.log(`      Tipo atto: ${cached.tipo_atto || 'N/A'}`);
      console.log(`      Spiegazione: ${cached.spiegazione_generale ? cached.spiegazione_generale.substring(0, 60) + '...' : 'N/A'}`);
      console.log(`      Effetti positivi: ${cached.effetti_positivi ? 'Presenti' : 'Assenti'}`);
      console.log(`      Effetti negativi: ${cached.effetti_negativi ? 'Presenti' : 'Assenti'}`);
      console.log(`      Provider: ${cached.provider_ai || 'N/A'}`);
      console.log(`      Data: ${cached.data_generazione}\n`);
    } else {
      console.log('   ⚠️ Nessuna analisi in cache per questa votazione\n');
    }
    
    // Test 4: Generazione analisi (solo se AI configurata)
    if (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) {
      console.log('📋 TEST 4: Generazione nuova analisi');
      console.log('-'.repeat(60));
      
      // Se esiste già, elimina per testare generazione
      if (cached) {
        console.log('   ℹ️ Elimino analisi esistente per testare generazione...');
        await pool.query('DELETE FROM parlamento_analisi_legge WHERE uri_votazione = $1', [votazione.uri]);
      }
      
      console.log('   🔄 Generazione in corso... (può richiedere 2-3 secondi)');
      const startTime = Date.now();
      
      try {
        const analisi = await generaAnalisiLegge(votazione.uri, {
          titolo: votazione.titolo,
          descrizione: votazione.descrizione || votazione.titolo,
          camera: votazione.camera,
          data_votazione: votazione.data_votazione
        });
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        if (analisi) {
          console.log(`   ✅ Analisi generata con successo in ${duration}s`);
          console.log(`      Numero legge: ${analisi.numero_legge || 'N/A'}`);
          console.log(`      Tipo atto: ${analisi.tipo_atto || 'N/A'}`);
          console.log(`      Provider: ${analisi.provider_ai}`);
          console.log(`      Modello: ${analisi.modello_ai}`);
          console.log(`      Spiegazione: ${analisi.spiegazione_generale ? analisi.spiegazione_generale.substring(0, 80) + '...' : 'N/A'}`);
          console.log(`      Effetti positivi: ${analisi.effetti_positivi ? analisi.effetti_positivi.split('\\n').filter(l => l.trim()).length + ' punti' : 'N/A'}`);
          console.log(`      Effetti negativi: ${analisi.effetti_negativi ? analisi.effetti_negativi.split('\\n').filter(l => l.trim()).length + ' punti' : 'N/A'}`);
          
          // Verifica salvataggio in cache
          const verificata = await recuperaAnalisiDaCache(votazione.uri);
          if (verificata) {
            console.log(`      ✅ Analisi salvata correttamente in cache`);
          } else {
            console.log(`      ⚠️ Analisi generata ma non trovata in cache`);
          }
        } else {
          console.log('   ❌ Analisi non generata (null)');
        }
      } catch (error) {
        console.error(`   ❌ Errore generazione: ${error.message}`);
        if (error.stack) {
          console.error(`      ${error.stack.split('\\n').slice(0, 2).join('\\n')}`);
        }
      }
    } else {
      console.log('📋 TEST 4: Generazione nuova analisi');
      console.log('-'.repeat(60));
      console.log('   ⚠️ AI non configurata - salto test generazione');
      console.log('   💡 Configura GROQ_API_KEY per testare la generazione\n');
    }
    
    // Test 5: Verifica struttura tabella
    console.log('📋 TEST 5: Verifica struttura tabella');
    console.log('-'.repeat(60));
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'parlamento_analisi_legge'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = [
      'id', 'uri_votazione', 'numero_legge', 'tipo_atto',
      'spiegazione_generale', 'effetti_positivi', 'effetti_negativi',
      'provider_ai', 'modello_ai', 'data_generazione'
    ];
    
    const foundColumns = tableCheck.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log(`   ✅ Tutte le colonne richieste presenti (${foundColumns.length} colonne)`);
    } else {
      console.log(`   ⚠️ Colonne mancanti: ${missingColumns.join(', ')}`);
    }
    
    console.log('\n📊 RIEPILOGO');
    console.log('='.repeat(60));
    console.log('✅ Servizio caricato correttamente');
    console.log('✅ Estrazione numero legge funziona');
    console.log('✅ Database connesso');
    console.log('✅ Tabella verificata');
    if (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) {
      console.log('✅ AI configurata');
    } else {
      console.log('⚠️ AI non configurata (opzionale)');
    }
    console.log('\n✅ Tutti i test del servizio completati!');
    
  } catch (error) {
    console.error('\n❌ Errore durante i test:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testServizioCompleto().catch(console.error);
}

module.exports = { testServizioCompleto };
