// Test semplificato per verificare tabella e connessione database
require('dotenv').config();
const { Pool } = require('pg');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function testConnessione() {
  console.log('🔍 TEST: Connessione Database');
  console.log('='.repeat(60));
  
  try {
    const result = await pool.query('SELECT NOW() as now');
    console.log('✅ Connessione database OK');
    console.log(`   Timestamp: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('❌ Errore connessione database:', error.message);
    if (error.message.includes('DATABASE_URL')) {
      console.error('   Verifica che DATABASE_URL sia configurato nelle variabili d\'ambiente');
    }
    return false;
  }
}

async function testTabella() {
  console.log('\n🔍 TEST: Verifica Tabella parlamento_analisi_legge');
  console.log('='.repeat(60));
  
  try {
    // Verifica esistenza
    const existsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'parlamento_analisi_legge'
      );
    `);
    
    if (!existsResult.rows[0].exists) {
      console.log('❌ Tabella parlamento_analisi_legge NON esiste');
      console.log('   Esegui: psql $DATABASE_URL -f create-parlamento-analisi-legge-table.sql');
      return false;
    }
    
    console.log('✅ Tabella parlamento_analisi_legge esiste');
    
    // Verifica struttura
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'parlamento_analisi_legge'
      ORDER BY ordinal_position
    `);
    
    console.log(`\n   Colonne (${columnsResult.rows.length}):`);
    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    
    // Conta righe
    const countResult = await pool.query('SELECT COUNT(*) as count FROM parlamento_analisi_legge');
    console.log(`\n   Righe presenti: ${countResult.rows[0].count}`);
    
    // Mostra esempio se presente
    if (parseInt(countResult.rows[0].count) > 0) {
      const sampleResult = await pool.query(`
        SELECT uri_votazione, numero_legge, tipo_atto, 
               provider_ai, modello_ai, data_generazione
        FROM parlamento_analisi_legge
        ORDER BY data_generazione DESC
        LIMIT 1
      `);
      
      const sample = sampleResult.rows[0];
      console.log('\n   Esempio analisi:');
      console.log(`   - URI: ${sample.uri_votazione}`);
      console.log(`   - Numero legge: ${sample.numero_legge || 'N/A'}`);
      console.log(`   - Tipo atto: ${sample.tipo_atto || 'N/A'}`);
      console.log(`   - Provider: ${sample.provider_ai || 'N/A'}`);
      console.log(`   - Modello: ${sample.modello_ai || 'N/A'}`);
      console.log(`   - Data: ${sample.data_generazione}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Errore verifica tabella:', error.message);
    return false;
  }
}

async function testVotazioniDisponibili() {
  console.log('\n🔍 TEST: Votazioni disponibili per test');
  console.log('='.repeat(60));
  
  try {
    const result = await pool.query(`
      SELECT uri, titolo, camera, data_votazione
      FROM parlamento
      WHERE titolo IS NOT NULL AND titolo != ''
      ORDER BY data_votazione DESC NULLS LAST, created_at DESC
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Nessuna votazione trovata nel database');
      console.log('   Esegui prima la sincronizzazione votazioni');
      return false;
    }
    
    console.log(`✅ Trovate ${result.rows.length} votazioni:`);
    result.rows.forEach((v, i) => {
      console.log(`\n   ${i + 1}. ${v.titolo}`);
      console.log(`      Camera: ${v.camera}`);
      console.log(`      Data: ${v.data_votazione || 'N/A'}`);
      console.log(`      URI: ${v.uri.substring(0, 80)}...`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Errore recupero votazioni:', error.message);
    return false;
  }
}

async function testServizio() {
  console.log('\n🔍 TEST: Verifica servizio leggeAnalysisService');
  console.log('='.repeat(60));
  
  try {
    const { 
      estraiNumeroLegge,
      estraiTipoAtto,
      recuperaAnalisiDaCache
    } = require('./services/leggeAnalysisService');
    
    console.log('✅ Servizio caricato correttamente');
    
    // Test estrazione
    const titolo = 'Disegno di legge n. 1718. Votazione questione fiducia';
    const numero = estraiNumeroLegge(titolo);
    const tipo = estraiTipoAtto(titolo);
    
    console.log(`\n   Test estrazione:`);
    console.log(`   Titolo: "${titolo}"`);
    console.log(`   → Numero: ${numero || 'N/A'}`);
    console.log(`   → Tipo: ${tipo || 'N/A'}`);
    
    if (numero === '1718' && tipo === 'Disegno di legge') {
      console.log('   ✅ Estrazione funziona correttamente');
    } else {
      console.log('   ⚠️ Estrazione potrebbe non funzionare correttamente');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Errore caricamento servizio:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 TEST SEMPLIFICATO: Analisi Legge');
  console.log('='.repeat(60));
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Configurato ✅' : 'NON configurato ❌'}`);
  console.log('');
  
  const results = {
    connessione: false,
    tabella: false,
    votazioni: false,
    servizio: false
  };
  
  try {
    results.connessione = await testConnessione();
    
    if (results.connessione) {
      results.tabella = await testTabella();
      results.votazioni = await testVotazioniDisponibili();
    }
    
    results.servizio = await testServizio();
    
    console.log('\n📊 RIEPILOGO TEST');
    console.log('='.repeat(60));
    console.log(`Connessione DB: ${results.connessione ? '✅' : '❌'}`);
    console.log(`Tabella esiste: ${results.tabella ? '✅' : '❌'}`);
    console.log(`Votazioni disponibili: ${results.votazioni ? '✅' : '❌'}`);
    console.log(`Servizio funziona: ${results.servizio ? '✅' : '❌'}`);
    
    const allOk = Object.values(results).every(r => r);
    if (allOk) {
      console.log('\n✅ Tutti i test base sono passati!');
      console.log('\n💡 Prossimi passi:');
      console.log('   1. Configura GROQ_API_KEY per testare la generazione AI');
      console.log('   2. Testa l\'endpoint API: GET /api/voti-politici/dettagli/:uri');
      console.log('   3. Verifica il frontend mostra le nuove sezioni');
    } else {
      console.log('\n⚠️ Alcuni test non sono passati');
      console.log('   Verifica la configurazione e riprova');
    }
  } catch (error) {
    console.error('\n❌ Errore durante i test:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
