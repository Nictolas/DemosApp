const axios = require('axios');

async function testSparqlQueries() {
  const endpoint = 'http://dati.camera.it/sparql';
  
  const queries = [
    {
      name: 'Query 1: Tutte le risorse',
      query: `SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10`
    },
    {
      name: 'Query 2: Cerca Votazione senza prefisso',
      query: `SELECT ?v WHERE { ?v a <http://dati.camera.it/ocd/Votazione> } LIMIT 10`
    },
    {
      name: 'Query 3: Cerca con prefisso ocd',
      query: `PREFIX ocd: <http://dati.camera.it/ocd/> SELECT ?v WHERE { ?v a ocd:Votazione } LIMIT 10`
    },
    {
      name: 'Query 4: Cerca qualsiasi tipo',
      query: `SELECT DISTINCT ?type WHERE { ?s a ?type } LIMIT 20`
    },
    {
      name: 'Query 5: Cerca legislatura',
      query: `PREFIX ocd: <http://dati.camera.it/ocd/> SELECT ?l WHERE { ?l a ocd:Legislatura } LIMIT 10`
    }
  ];
  
  for (const test of queries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(test.name);
    console.log('='.repeat(80));
    
    try {
      const params = new URLSearchParams();
      params.append('query', test.query);
      params.append('format', 'json');
      
      const response = await axios.get(`${endpoint}?${params.toString()}`, {
        headers: {
          'Accept': 'application/sparql-results+json, application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      const bindings = response.data?.results?.bindings || [];
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Risultati: ${bindings.length} bindings`);
      
      if (bindings.length > 0) {
        console.log('✅ SUCCESSO! Trovati risultati:');
        console.log(JSON.stringify(bindings.slice(0, 3), null, 2));
        return test.query; // Restituisce la query che funziona
      } else {
        console.log('⚠️ Nessun risultato');
      }
    } catch (error) {
      console.error(`❌ Errore: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }
  
  return null;
}

testSparqlQueries().then(query => {
  if (query) {
    console.log(`\n✅ Query funzionante trovata: ${query}`);
  } else {
    console.log('\n❌ Nessuna query ha restituito risultati');
  }
  process.exit(0);
}).catch(err => {
  console.error('Errore generale:', err);
  process.exit(1);
});

