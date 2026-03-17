const axios = require('axios');

async function testCameraSeduta() {
  console.log('\n🔍 TEST CAMERA - Verifica struttura seduta\n');
  
  // Prova query alternativa per vedere se la seduta è collegata diversamente
  const query1 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?seduta ?predicato ?oggetto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione ?predicato ?oggetto . }
      FILTER(CONTAINS(STR(?predicato), "seduta") || CONTAINS(STR(?predicato), "Seduta"))
    }
    LIMIT 5
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query1);
    params.append('format', 'json');
    
    const response = await axios.get(`http://dati.camera.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} risultati\n`);
    
    const predicati = new Set();
    bindings.forEach(b => {
      if (b.predicato?.value) {
        predicati.add(b.predicato.value);
      }
    });
    
    console.log('📋 Predicati trovati che contengono "seduta":');
    Array.from(predicati).forEach(p => console.log(`   - ${p}`));
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Prova query per vedere tutte le proprietà di una seduta
  console.log('\n🔍 Test: Recupera una seduta e le sue proprietà\n');
  
  const query2 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?seduta ?predicato ?oggetto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      ?votazione ocd:rif_seduta ?seduta .
      ?seduta ?predicato ?oggetto .
    }
    LIMIT 20
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query2);
    params.append('format', 'json');
    
    const response = await axios.get(`http://dati.camera.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} proprietà di sedute\n`);
    
    if (bindings.length > 0) {
      const sedute = {};
      bindings.forEach(b => {
        const sedutaUri = b.seduta?.value;
        if (!sedute[sedutaUri]) {
          sedute[sedutaUri] = {};
        }
        sedute[sedutaUri][b.predicato?.value] = b.oggetto?.value;
      });
      
      console.log('📋 Esempio seduta con tutte le proprietà:');
      const primaSeduta = Object.keys(sedute)[0];
      console.log(`\n   URI Seduta: ${primaSeduta}`);
      Object.entries(sedute[primaSeduta]).forEach(([pred, obj]) => {
        console.log(`   ${pred}: ${obj}`);
      });
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
}

testCameraSeduta().catch(console.error);
