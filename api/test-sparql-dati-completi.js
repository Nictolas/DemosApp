const axios = require('axios');

async function testDatiCompleti() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 ANALISI DATI COMPLETI DISPONIBILI DA SPARQL');
  console.log('='.repeat(80));
  
  // Test Senato - Verifica tutti i predicati disponibili
  console.log('\n📊 SENATO - Analisi predicati disponibili per una votazione\n');
  
  const querySenato = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    
    SELECT DISTINCT ?votazione ?predicato ?oggetto
    WHERE {
      ?votazione a osr:Votazione .
      ?votazione ?predicato ?oggetto .
    }
    LIMIT 100
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', querySenato);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati\n`);
    
    // Raggruppa per predicato
    const predicati = {};
    bindings.forEach(b => {
      const pred = b.predicato?.value;
      if (pred && !predicati[pred]) {
        predicati[pred] = [];
      }
      if (pred && b.oggetto?.value) {
        predicati[pred].push(b.oggetto.value);
      }
    });
    
    console.log('📋 Predicati disponibili per le votazioni Senato:');
    Object.keys(predicati).sort().forEach(pred => {
      const esempi = predicati[pred].slice(0, 3);
      console.log(`\n   ${pred}`);
      console.log(`      Esempi: ${esempi.join(', ')}${predicati[pred].length > 3 ? '...' : ''}`);
    });
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test Senato - Verifica se c'è un collegamento all'atto legislativo
  console.log('\n\n📊 SENATO - Verifica collegamento all\'atto legislativo\n');
  
  const queryAtto = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?predicato ?oggetto
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione ?predicato ?oggetto . }
      FILTER(
        CONTAINS(STR(?predicato), "atto") || 
        CONTAINS(STR(?predicato), "Atto") ||
        CONTAINS(STR(?predicato), "disegno") ||
        CONTAINS(STR(?predicato), "Disegno") ||
        CONTAINS(STR(?predicato), "legge") ||
        CONTAINS(STR(?predicato), "Legge") ||
        CONTAINS(STR(?predicato), "proposta") ||
        CONTAINS(STR(?predicato), "Proposta")
      )
    }
    LIMIT 50
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryAtto);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} collegamenti ad atti\n`);
    
    if (bindings.length > 0) {
      bindings.slice(0, 5).forEach((b, i) => {
        console.log(`${i + 1}. Votazione: ${b.label?.value || 'N/A'}`);
        console.log(`   Predicato: ${b.predicato?.value}`);
        console.log(`   Oggetto: ${b.oggetto?.value}`);
        console.log('');
      });
    } else {
      console.log('⚠️ Nessun collegamento diretto ad atti trovato');
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test Senato - Verifica se la seduta ha informazioni sull'atto
  console.log('\n\n📊 SENATO - Verifica informazioni dalla seduta\n');
  
  const querySeduta = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?seduta ?predicatoSeduta ?oggettoSeduta
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione osr:seduta ?seduta . }
      OPTIONAL { ?seduta ?predicatoSeduta ?oggettoSeduta . }
      FILTER(
        CONTAINS(STR(?predicatoSeduta), "atto") || 
        CONTAINS(STR(?predicatoSeduta), "Atto") ||
        CONTAINS(STR(?predicatoSeduta), "disegno") ||
        CONTAINS(STR(?predicatoSeduta), "Disegno") ||
        CONTAINS(STR(?predicatoSeduta), "legge") ||
        CONTAINS(STR(?predicatoSeduta), "Legge") ||
        CONTAINS(STR(?predicatoSeduta), "titolo") ||
        CONTAINS(STR(?predicatoSeduta), "Titolo") ||
        CONTAINS(STR(?predicatoSeduta), "oggetto") ||
        CONTAINS(STR(?predicatoSeduta), "Oggetto")
      )
    }
    LIMIT 50
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', querySeduta);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati dalla seduta\n`);
    
    if (bindings.length > 0) {
      bindings.slice(0, 5).forEach((b, i) => {
        console.log(`${i + 1}. Votazione: ${b.label?.value || 'N/A'}`);
        console.log(`   Predicato Seduta: ${b.predicatoSeduta?.value}`);
        console.log(`   Oggetto: ${b.oggettoSeduta?.value}`);
        console.log('');
      });
    } else {
      console.log('⚠️ Nessuna informazione aggiuntiva dalla seduta');
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test Camera - Stessa analisi
  console.log('\n\n📊 CAMERA - Analisi predicati disponibili\n');
  
  const queryCamera = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?predicato ?oggetto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      ?votazione ?predicato ?oggetto .
      FILTER(
        CONTAINS(STR(?predicato), "atto") || 
        CONTAINS(STR(?predicato), "Atto") ||
        CONTAINS(STR(?predicato), "disegno") ||
        CONTAINS(STR(?predicato), "Disegno") ||
        CONTAINS(STR(?predicato), "legge") ||
        CONTAINS(STR(?predicato), "Legge") ||
        CONTAINS(STR(?predicato), "titolo") ||
        CONTAINS(STR(?predicato), "Titolo") ||
        CONTAINS(STR(?predicato), "oggetto") ||
        CONTAINS(STR(?predicato), "Oggetto")
      )
    }
    LIMIT 50
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryCamera);
    params.append('format', 'json');
    
    const response = await axios.get(`http://dati.camera.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati Camera\n`);
    
    if (bindings.length > 0) {
      bindings.slice(0, 5).forEach((b, i) => {
        console.log(`${i + 1}. Predicato: ${b.predicato?.value}`);
        console.log(`   Oggetto: ${b.oggetto?.value}`);
        console.log('');
      });
    } else {
      console.log('⚠️ Nessun predicato rilevante trovato');
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ANALISI COMPLETATA');
  console.log('='.repeat(80));
}

testDatiCompleti().catch(console.error);
