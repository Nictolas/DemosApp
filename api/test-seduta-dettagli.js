const axios = require('axios');

async function testSedutaDettagli() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 ANALISI DETTAGLI SEDUTA E COLLEGAMENTI');
  console.log('='.repeat(80));
  
  // Test: Prendi una seduta specifica e vedi tutte le sue proprietà
  console.log('\n📊 SENATO - Analisi completa di una seduta\n');
  
  const querySeduta = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?seduta ?predicato ?oggetto
    WHERE {
      ?votazione a osr:Votazione .
      ?votazione osr:seduta ?seduta .
      ?seduta ?predicato ?oggetto .
    }
    LIMIT 200
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
      timeout: 60000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati dalle sedute\n`);
    
    // Raggruppa per seduta
    const sedute = {};
    bindings.forEach(b => {
      const sedutaUri = b.seduta?.value;
      if (!sedute[sedutaUri]) {
        sedute[sedutaUri] = {};
      }
      const pred = b.predicato?.value;
      const obj = b.oggetto?.value;
      if (pred && obj) {
        if (!sedute[sedutaUri][pred]) {
          sedute[sedutaUri][pred] = [];
        }
        sedute[sedutaUri][pred].push(obj);
      }
    });
    
    const primaSeduta = Object.keys(sedute)[0];
    if (primaSeduta) {
      console.log(`📋 Esempio seduta: ${primaSeduta}\n`);
      console.log('Predicati disponibili:');
      Object.keys(sedute[primaSeduta]).sort().forEach(pred => {
        const valori = sedute[primaSeduta][pred];
        const esempi = valori.slice(0, 2).join(', ');
        console.log(`\n   ${pred}`);
        console.log(`      Valori: ${esempi}${valori.length > 2 ? '...' : ''} (${valori.length} totali)`);
      });
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test: Verifica se ci sono collegamenti a ordini del giorno o atti
  console.log('\n\n📊 SENATO - Verifica ordini del giorno e atti\n');
  
  const queryOdg = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?seduta ?predicato ?oggetto
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione osr:seduta ?seduta . }
      OPTIONAL { 
        ?seduta ?predicato ?oggetto .
        FILTER(
          CONTAINS(STR(?predicato), "ordine") ||
          CONTAINS(STR(?predicato), "Ordine") ||
          CONTAINS(STR(?predicato), "odg") ||
          CONTAINS(STR(?predicato), "ODG") ||
          CONTAINS(STR(?predicato), "disegno") ||
          CONTAINS(STR(?predicato), "Disegno") ||
          CONTAINS(STR(?predicato), "atto") ||
          CONTAINS(STR(?predicato), "Atto")
        )
      }
    }
    LIMIT 50
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryOdg);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 60000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} risultati\n`);
    
    if (bindings.length > 0) {
      bindings.slice(0, 5).forEach((b, i) => {
        console.log(`${i + 1}. Votazione: ${b.label?.value || 'N/A'}`);
        console.log(`   Predicato: ${b.predicato?.value || 'N/A'}`);
        console.log(`   Oggetto: ${b.oggetto?.value || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️ Nessun collegamento a ordini del giorno o atti trovato');
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test: Verifica se possiamo usare l'URI della votazione per ottenere più info
  console.log('\n\n📊 SENATO - Verifica se l\'URI della votazione ha più informazioni\n');
  
  const queryUri = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?predicato ?oggetto
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      ?votazione ?predicato ?oggetto .
      FILTER(
        !CONTAINS(STR(?predicato), "favorevole") &&
        !CONTAINS(STR(?predicato), "contrario") &&
        !CONTAINS(STR(?predicato), "seduta") &&
        !CONTAINS(STR(?predicato), "type") &&
        !CONTAINS(STR(?predicato), "label")
      )
    }
    LIMIT 100
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryUri);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati aggiuntivi\n`);
    
    const predicatiUnici = new Set();
    bindings.forEach(b => {
      if (b.predicato?.value) {
        predicatiUnici.add(b.predicato.value);
      }
    });
    
    console.log('Predicati aggiuntivi disponibili:');
    Array.from(predicatiUnici).sort().forEach(pred => {
      console.log(`   - ${pred}`);
    });
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ANALISI COMPLETATA');
  console.log('='.repeat(80));
  console.log('\n💡 CONCLUSIONE: Gli endpoint SPARQL forniscono solo dati tecnici sulle votazioni.');
  console.log('💡 Per ottenere il contesto legislativo (nome legge, numero, descrizione)');
  console.log('💡 potremmo dover usare altre fonti o scraping da Openpolis/portali ufficiali.');
}

testSedutaDettagli().catch(console.error);
