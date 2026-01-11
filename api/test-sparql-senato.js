#!/usr/bin/env node
/**
 * Script di test per verificare l'endpoint SPARQL del Senato
 * Verifica che l'endpoint funzioni e quali dati sono disponibili
 */

const axios = require('axios');

const SENATO_ENDPOINT = 'https://dati.senato.it/sparql';

// Test 1: Query base per verificare che l'endpoint risponda
async function testEndpointBase() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Verifica endpoint base');
  console.log('='.repeat(80));
  
  const query = `
    SELECT DISTINCT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 5
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${SENATO_ENDPOINT}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    console.log('✅ Endpoint risponde correttamente');
    console.log(`   Status: ${response.status}`);
    console.log(`   Risultati: ${response.data?.results?.bindings?.length || 0} bindings`);
    
    if (response.data?.results?.bindings?.length > 0) {
      console.log('\n   Esempio risultato:');
      console.log(JSON.stringify(response.data.results.bindings[0], null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Errore:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    return false;
  }
}

// Test 2: Cerca tipi di risorse disponibili
async function testTipiRisorse() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Tipi di risorse disponibili');
  console.log('='.repeat(80));
  
  const query = `
    SELECT DISTINCT ?type WHERE { ?s a ?type } LIMIT 20
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${SENATO_ENDPOINT}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} tipi di risorse:\n`);
    
    bindings.forEach((binding, idx) => {
      const type = binding.type?.value || 'N/A';
      console.log(`   ${idx + 1}. ${type}`);
    });
    
    return bindings;
  } catch (error) {
    console.error('❌ Errore:', error.message);
    return [];
  }
}

// Test 3: Cerca votazioni con namespace Camera (per vedere se usa lo stesso)
async function testVotazioniCameraNamespace() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Cerca votazioni con namespace Camera');
  console.log('='.repeat(80));
  
  const query = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    SELECT DISTINCT ?votazione WHERE { 
      ?votazione a ocd:Votazione 
    } LIMIT 10
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${SENATO_ENDPOINT}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} votazioni con namespace Camera`);
    
    if (bindings.length > 0) {
      console.log('\n   Esempi:');
      bindings.slice(0, 3).forEach((binding, idx) => {
        console.log(`   ${idx + 1}. ${binding.votazione?.value}`);
      });
    }
    
    return bindings;
  } catch (error) {
    console.error('❌ Errore:', error.message);
    return [];
  }
}

// Test 4: Cerca votazioni con namespace Senato
async function testVotazioniSenatoNamespace() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Cerca votazioni con namespace Senato');
  console.log('='.repeat(80));
  
  const query = `
    PREFIX ocd: <http://dati.senato.it/ocd/>
    SELECT DISTINCT ?votazione WHERE { 
      ?votazione a ocd:Votazione 
    } LIMIT 10
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${SENATO_ENDPOINT}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} votazioni con namespace Senato`);
    
    if (bindings.length > 0) {
      console.log('\n   Esempi:');
      bindings.slice(0, 3).forEach((binding, idx) => {
        console.log(`   ${idx + 1}. ${binding.votazione?.value}`);
      });
    }
    
    return bindings;
  } catch (error) {
    console.error('❌ Errore:', error.message);
    return [];
  }
}

// Test 5: Cerca votazioni senza namespace specifico
async function testVotazioniGeneriche() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Cerca votazioni generiche (qualsiasi tipo)');
  console.log('='.repeat(80));
  
  const query = `
    SELECT DISTINCT ?votazione WHERE { 
      ?votazione a ?type .
      FILTER(CONTAINS(STR(?votazione), "votazione") || 
             CONTAINS(STR(?votazione), "Votazione") ||
             CONTAINS(STR(?type), "votazione") ||
             CONTAINS(STR(?type), "Votazione"))
    } LIMIT 10
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${SENATO_ENDPOINT}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} risorse correlate a votazioni`);
    
    if (bindings.length > 0) {
      console.log('\n   Esempi:');
      bindings.slice(0, 3).forEach((binding, idx) => {
        console.log(`   ${idx + 1}. ${binding.votazione?.value}`);
      });
    }
    
    return bindings;
  } catch (error) {
    console.error('❌ Errore:', error.message);
    return [];
  }
}

// Test 6: Query completa con predicati (come nella Camera)
async function testQueryCompleta() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 6: Query completa con predicati (stile Camera)');
  console.log('='.repeat(80));
  
  // Prova prima con namespace Camera
  const queryCamera = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?approvato ?seduta
    WHERE {
      ?votazione a ocd:Votazione .
      FILTER(CONTAINS(STR(?votazione), "19") || CONTAINS(STR(?votazione), "vs19"))
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione ocd:approvato ?approvato . }
      OPTIONAL { ?votazione ocd:rif_seduta ?seduta . }
    }
    LIMIT 5
  `;
  
  console.log('\n   Provo con namespace Camera...');
  try {
    const params = new URLSearchParams();
    params.append('query', queryCamera);
    params.append('format', 'json');
    
    const response = await axios.get(`${SENATO_ENDPOINT}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`   ✅ Trovate ${bindings.length} votazioni con namespace Camera`);
    
    if (bindings.length > 0) {
      console.log('\n   Esempio risultato:');
      console.log(JSON.stringify(bindings[0], null, 2));
      return bindings;
    }
  } catch (error) {
    console.log(`   ❌ Errore con namespace Camera: ${error.message}`);
  }
  
  // Prova con namespace Senato
  const querySenato = `
    PREFIX ocd: <http://dati.senato.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?approvato ?seduta
    WHERE {
      ?votazione a ocd:Votazione .
      FILTER(CONTAINS(STR(?votazione), "19") || CONTAINS(STR(?votazione), "vs19"))
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione ocd:approvato ?approvato . }
      OPTIONAL { ?votazione ocd:rif_seduta ?seduta . }
    }
    LIMIT 5
  `;
  
  console.log('\n   Provo con namespace Senato...');
  try {
    const params = new URLSearchParams();
    params.append('query', querySenato);
    params.append('format', 'json');
    
    const response = await axios.get(`${SENATO_ENDPOINT}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`   ✅ Trovate ${bindings.length} votazioni con namespace Senato`);
    
    if (bindings.length > 0) {
      console.log('\n   Esempio risultato:');
      console.log(JSON.stringify(bindings[0], null, 2));
      return bindings;
    }
  } catch (error) {
    console.log(`   ❌ Errore con namespace Senato: ${error.message}`);
  }
  
  return [];
}

// Test 7: Esplora tutti i predicati di una votazione
async function testPredicatiVotazione() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 7: Esplora predicati disponibili per le votazioni');
  console.log('='.repeat(80));
  
  // Prima trova una votazione
  const queryFind = `
    SELECT DISTINCT ?votazione WHERE { 
      ?votazione a ?type .
      FILTER(CONTAINS(STR(?votazione), "votazione") || 
             CONTAINS(STR(?type), "votazione"))
    } LIMIT 1
  `;
  
  try {
    const paramsFind = new URLSearchParams();
    paramsFind.append('query', queryFind);
    paramsFind.append('format', 'json');
    
    const responseFind = await axios.get(`${SENATO_ENDPOINT}?${paramsFind.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const votazioni = responseFind.data?.results?.bindings || [];
    
    if (votazioni.length === 0) {
      console.log('⚠️ Nessuna votazione trovata per esplorare i predicati');
      return;
    }
    
    const votazioneUri = votazioni[0].votazione?.value;
    console.log(`\n   Esploro votazione: ${votazioneUri}\n`);
    
    // Ora trova tutti i predicati
    const queryPred = `
      SELECT DISTINCT ?predicato ?oggetto WHERE {
        <${votazioneUri}> ?predicato ?oggetto .
      } LIMIT 20
    `;
    
    const paramsPred = new URLSearchParams();
    paramsPred.append('query', queryPred);
    paramsPred.append('format', 'json');
    
    const responsePred = await axios.get(`${SENATO_ENDPOINT}?${paramsPred.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = responsePred.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati:\n`);
    
    bindings.forEach((binding, idx) => {
      const pred = binding.predicato?.value || 'N/A';
      const obj = binding.oggetto?.value || 'N/A';
      const predName = pred.split('/').pop().split('#').pop();
      console.log(`   ${idx + 1}. ${predName}`);
      console.log(`      Predicato: ${pred}`);
      console.log(`      Oggetto: ${obj.substring(0, 80)}${obj.length > 80 ? '...' : ''}`);
      console.log('');
    });
    
    return bindings;
  } catch (error) {
    console.error('❌ Errore:', error.message);
    return [];
  }
}

// Funzione principale
async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST ENDPOINT SPARQL SENATO');
  console.log('='.repeat(80));
  console.log(`Endpoint: ${SENATO_ENDPOINT}`);
  console.log('='.repeat(80));
  
  const results = {
    endpointBase: false,
    tipiRisorse: [],
    votazioniCamera: [],
    votazioniSenato: [],
    votazioniGeneriche: [],
    queryCompleta: [],
    predicati: []
  };
  
  // Esegui tutti i test
  results.endpointBase = await testEndpointBase();
  results.tipiRisorse = await testTipiRisorse();
  results.votazioniCamera = await testVotazioniCameraNamespace();
  results.votazioniSenato = await testVotazioniSenatoNamespace();
  results.votazioniGeneriche = await testVotazioniGeneriche();
  results.queryCompleta = await testQueryCompleta();
  results.predicati = await testPredicatiVotazione();
  
  // Riepilogo finale
  console.log('\n' + '='.repeat(80));
  console.log('RIEPILOGO TEST');
  console.log('='.repeat(80));
  console.log(`✅ Endpoint base: ${results.endpointBase ? 'OK' : 'FAIL'}`);
  console.log(`📊 Tipi risorse trovati: ${results.tipiRisorse.length}`);
  console.log(`📊 Votazioni (namespace Camera): ${results.votazioniCamera.length}`);
  console.log(`📊 Votazioni (namespace Senato): ${results.votazioniSenato.length}`);
  console.log(`📊 Votazioni generiche: ${results.votazioniGeneriche.length}`);
  console.log(`📊 Query completa risultati: ${results.queryCompleta.length}`);
  console.log(`📊 Predicati esplorati: ${results.predicati.length}`);
  console.log('='.repeat(80));
  
  // Raccomandazioni
  console.log('\n💡 RACCOMANDAZIONI:');
  if (results.votazioniCamera.length > 0) {
    console.log('   ✅ Il Senato usa lo stesso namespace della Camera');
    console.log('   ✅ Usa la stessa query della Camera');
  } else if (results.votazioniSenato.length > 0) {
    console.log('   ⚠️ Il Senato usa un namespace diverso');
    console.log('   ⚠️ Aggiorna la query con namespace Senato');
  } else {
    console.log('   ❌ Nessuna votazione trovata');
    console.log('   ❌ Verifica la struttura dei dati del Senato');
  }
  
  console.log('\n');
}

// Esegui i test
runAllTests().catch(err => {
  console.error('❌ Errore generale:', err);
  process.exit(1);
});
